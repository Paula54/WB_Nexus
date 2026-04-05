import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!stripeSecretKey || !webhookSecret) {
    console.error('Missing Stripe secrets');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`Processing event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;

        // ── Handle AI Fuel credit top-up (one-time payment) ──
        if (session.metadata?.type === 'credit_topup' && userId) {
          const credits = parseInt(session.metadata.credits || '0', 10);
          if (credits > 0) {
            // Add credits to user's wallet
            const { data: existing } = await supabase
              .from('nx_usage_credits')
              .select('total_credits')
              .eq('user_id', userId)
              .maybeSingle();

            if (existing) {
              await supabase
                .from('nx_usage_credits')
                .update({ total_credits: existing.total_credits + credits })
                .eq('user_id', userId);
            } else {
              await supabase
                .from('nx_usage_credits')
                .insert({ user_id: userId, total_credits: credits, used_credits: 0, plan_name: 'TopUp' });
            }

            // Record wallet transaction
            await supabase.from('wallet_transactions').insert({
              user_id: userId,
              amount: credits,
              type: 'credit_topup',
              description: `AI Fuel Top-up: +${credits} créditos (Pack ${session.metadata.pack})`,
              reference_id: session.id,
            });

            console.log(`Credits topped up: user=${userId}, credits=${credits}`);
          }
          break;
        }

        // ── Handle wallet top-up (legacy) ──
        if (session.metadata?.type === 'wallet_topup' && userId) {
          const amount = parseFloat(session.metadata.amount || '0');
          if (amount > 0) {
            await supabase.from('wallet_transactions').insert({
              user_id: userId,
              amount,
              type: 'deposit',
              description: `Carregamento via Stripe`,
              reference_id: session.id,
            });
            console.log(`Wallet topped up: user=${userId}, amount=${amount}`);
          }
          break;
        }

        // ── Handle subscription checkout ──
        const projectId = session.metadata?.project_id;
        const planType = session.metadata?.plan_type || 'START';

        if (!projectId || !userId) {
          console.error('Missing metadata in checkout session:', session.id);
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

        // Map Stripe status to our status — ensure 'active' after successful payment
        const mappedStatus = subscription.status === 'trialing' ? 'trialing' : 'active';

        const { error: subError } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            project_id: projectId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            status: mappedStatus,
            plan_type: planType,
            trial_ends_at: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          }, { onConflict: 'stripe_subscription_id' });

        if (subError) {
          console.error('Error upserting subscription:', subError);
          break;
        }

        const trialEndsAt = subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

        await supabase
          .from('projects')
          .update({ selected_plan: planType, trial_expires_at: trialEndsAt })
          .eq('id', projectId);

        // ── Sync customer details from Stripe to Supabase ──
        try {
          const customerDetails = session.customer_details;
          const customerName = customerDetails?.name || null;
          const customerEmail = customerDetails?.email || null;
          const customerPhone = customerDetails?.phone || null;

          // Extract NIF from tax_ids (format: PT123456789 → 123456789)
          let nifValue: string | null = null;
          if (customerDetails?.tax_ids && customerDetails.tax_ids.length > 0) {
            const euVat = customerDetails.tax_ids.find((t: any) => t.type === 'eu_vat');
            if (euVat?.value) {
              nifValue = euVat.value.replace(/^PT/i, '');
            }
          }

          // Update profiles: full_name + contact_email
          if (customerName || customerEmail) {
            await supabase
              .from('profiles')
              .update({
                ...(customerName ? { full_name: customerName } : {}),
                ...(customerEmail ? { contact_email: customerEmail } : {}),
              })
              .eq('user_id', userId);
          }

          // Update business_profiles: nif, phone, legal_name
          const bizUpdate: Record<string, string | null> = {};
          if (nifValue) bizUpdate.nif = nifValue;
          if (customerPhone) bizUpdate.phone = customerPhone;
          if (customerName) bizUpdate.legal_name = customerName;

          if (Object.keys(bizUpdate).length > 0) {
            const { data: existingBiz } = await supabase
              .from('business_profiles')
              .select('id')
              .eq('user_id', userId)
              .maybeSingle();

            if (existingBiz) {
              await supabase
                .from('business_profiles')
                .update(bizUpdate)
                .eq('user_id', userId);
            } else {
              await supabase
                .from('business_profiles')
                .insert({ user_id: userId, ...bizUpdate });
            }
          }

          console.log(`Customer details synced: name=${customerName}, email=${customerEmail}, nif=${nifValue}`);
        } catch (syncErr) {
          console.warn('Non-blocking customer sync error:', syncErr);
        }

        console.log(`Checkout completed: user=${userId}, project=${projectId}, plan=${planType}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeSubId = subscription.id;

        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            trial_ends_at: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
          })
          .eq('stripe_subscription_id', stripeSubId);

        if (subscription.status === 'active' || subscription.status === 'past_due') {
          const { data: subData } = await supabase
            .from('subscriptions')
            .select('project_id')
            .eq('stripe_subscription_id', stripeSubId)
            .single();

          if (subData?.project_id) {
            await supabase
              .from('projects')
              .update({
                trial_expires_at: subscription.status === 'active'
                  ? new Date(subscription.current_period_end * 1000).toISOString()
                  : null,
              })
              .eq('id', subData.project_id);
          }
        }

        console.log(`Subscription updated: ${stripeSubId} -> ${subscription.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeSubId = subscription.id;

        const { data: subData } = await supabase
          .from('subscriptions')
          .select('project_id')
          .eq('stripe_subscription_id', stripeSubId)
          .single();

        await supabase
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', stripeSubId);

        if (subData?.project_id) {
          await supabase
            .from('projects')
            .update({ trial_expires_at: new Date().toISOString() })
            .eq('id', subData.project_id);
        }

        console.log(`Subscription canceled: ${stripeSubId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('Error processing webhook event:', err);
    return new Response(JSON.stringify({ error: 'Internal processing error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
