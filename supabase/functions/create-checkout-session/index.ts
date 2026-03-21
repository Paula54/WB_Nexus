import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// New Elite White Label pricing with setup fees
const PLAN_CONFIG: Record<string, {
  name: string;
  subscription_price_id: string;
  setup_price_id: string;
  description: string;
}> = {
  START: {
    name: 'Nexus Start',
    subscription_price_id: 'price_1TDVUhE6rYpESbYpCArPIGK3',
    setup_price_id: 'price_1TDVV0E6rYpESbYpcsLBHH3G',
    description: 'SEO e Validação — 49€/mês + Taxa de Ativação 790€',
  },
  GROWTH: {
    name: 'Nexus Growth',
    subscription_price_id: 'price_1TDVVlCn71ikcRodagEgCCYa',
    setup_price_id: 'price_1TDVZVCn71ikcRodnS0pcbQQ',
    description: 'Blog IA, Ads e Newsletters — 149€/mês + Taxa de Ativação 1.490€',
  },
  NEXUS_OS: {
    name: 'Nexus OS',
    subscription_price_id: 'price_1TDVaUE6rYpESbYpMpKupCc5',
    setup_price_id: 'price_1TDVauCn71ikcRodX3dJZbTN',
    description: 'WhatsApp AI, CRM e Gestão Total — 299€/mês + Taxa de Ativação 2.490€',
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = userData.user;
    const { planType, projectId, successUrl, cancelUrl } = await req.json();

    if (!planType || !PLAN_CONFIG[planType]) {
      return new Response(JSON.stringify({ error: 'Invalid plan type. Use START, GROWTH, or NEXUS_OS.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!projectId) {
      return new Response(JSON.stringify({ error: 'Project ID is required.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const plan = PLAN_CONFIG[planType];
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-08-27.basil' });

    // Find or create customer
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Checkout with subscription + one-time setup fee in a single session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      locale: 'pt',
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        // Recurring subscription
        { price: plan.subscription_price_id, quantity: 1 },
        // One-time setup fee (Taxa de Ativação)
        { price: plan.setup_price_id, quantity: 1 },
      ],
      subscription_data: {
        metadata: {
          project_id: projectId,
          user_id: user.id,
          plan_type: planType,
        },
      },
      metadata: {
        project_id: projectId,
        user_id: user.id,
        plan_type: planType,
      },
      success_url: successUrl || 'https://marketing-ai-core.lovable.app/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl || 'https://marketing-ai-core.lovable.app/settings/subscription?checkout=cancel',
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return new Response(JSON.stringify({ error: (err as Error).message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
