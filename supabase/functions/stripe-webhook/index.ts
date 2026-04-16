import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getErrorMessage(error: unknown) {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) return String((error as { message?: unknown }).message ?? '');
  return String(error);
}

function isMissingColumnError(error: unknown, column: string) {
  return getErrorMessage(error).toLowerCase().includes(column.toLowerCase());
}

function buildPlanPayload(payload: Record<string, unknown>, plan: string, useLegacyColumn = false) {
  return {
    ...payload,
    ...(useLegacyColumn ? { plan_type: plan } : { plan_name: plan }),
  };
}

async function upsertSubscriptionRecord(supabase: any, payload: Record<string, unknown>, plan: string) {
  let response = await supabase
    .from('subscriptions')
    .upsert(buildPlanPayload(payload, plan), { onConflict: 'stripe_subscription_id' });

  if (response.error && isMissingColumnError(response.error, 'plan_name')) {
    response = await supabase
      .from('subscriptions')
      .upsert(buildPlanPayload(payload, plan, true), { onConflict: 'stripe_subscription_id' });
  }

  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('PROD_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('PROD_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('[stripe-webhook] Using Supabase URL:', supabaseUrl);

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

        // ── Handle subscription checkout (supports guest purchases) ──
        let resolvedUserId = userId;
        let projectId = session.metadata?.project_id;
        const planType = session.metadata?.plan_name || session.metadata?.plan_type || 'START';
        const customerEmail = session.customer_details?.email || session.customer_email;

        // ── Read quiz/lead metadata from Site ──
        const leadId = session.metadata?.lead_id || null;
        const leadDesafio = session.metadata?.lead_desafio || null;
        const leadInvestimento = session.metadata?.lead_investimento || null;
        const leadWhatsapp = session.metadata?.lead_whatsapp || null;

        console.log(`[webhook] Quiz metadata: lead_id=${leadId}, desafio=${leadDesafio}, investimento=${leadInvestimento}, whatsapp=${leadWhatsapp}`);

        // If no user_id in metadata, find or create user from Stripe email
        if (!resolvedUserId && customerEmail) {
          console.log(`[webhook] No user_id in metadata, resolving from email: ${customerEmail}`);

          // Check if user exists in Supabase Auth
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find(
            (u: any) => u.email?.toLowerCase() === customerEmail.toLowerCase()
          );

          if (existingUser) {
            resolvedUserId = existingUser.id;
            console.log(`[webhook] Found existing user: ${resolvedUserId}`);
          } else {
            // Create new user with temp password
            const tempPassword = crypto.randomUUID() + 'Aa1!';
            const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
              email: customerEmail,
              password: tempPassword,
              email_confirm: true,
              user_metadata: {
                full_name: session.customer_details?.name || null,
                lead_desafio: leadDesafio,
                lead_investimento: leadInvestimento,
              },
            });
            if (createErr || !newUser?.user) {
              console.error('[webhook] Failed to create user:', createErr);
              break;
            }
            resolvedUserId = newUser.user.id;
            console.log(`[webhook] Created new user: ${resolvedUserId}`);

            // Create profile for new user with quiz data
            await supabase.from('profiles').upsert({
              user_id: resolvedUserId,
              full_name: session.customer_details?.name || null,
              contact_email: customerEmail,
              business_sector: leadDesafio || null,
            }, { onConflict: 'user_id' });
          }
        }

        // ── Invite user via Supabase Auth (universal onboarding) ──
        try {
          const inviteEmail = session.customer_details?.email || session.customer_email;
          if (inviteEmail) {
            // Check if user already has a password set (existing user)
            const { data: existingUser } = await supabase.auth.admin.getUserById(resolvedUserId);
            const hasPassword = existingUser?.user?.email_confirmed_at;

            if (!hasPassword) {
              const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(inviteEmail, {
                redirectTo: 'https://nexus.web-business.pt/auth/set-password',
                data: {
                  project_id: projectId,
                  plan_type: planType,
                },
              });

              if (inviteError) {
                console.warn('Invite email warning:', inviteError.message);
              } else {
                console.log(`Invite sent to ${inviteEmail}`);
              }
            } else {
              console.log(`User ${inviteEmail} already confirmed, skipping invite`);
            }
          }
        } catch (inviteErr) {
          console.warn('Non-blocking invite error:', inviteErr);
        }

        console.log(`Checkout completed: user=${resolvedUserId}, project=${projectId}, plan=${planType}`);
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
