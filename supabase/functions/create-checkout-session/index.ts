import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Plan configuration: recurring prices in cents
const PLAN_CONFIG: Record<string, { name: string; amount: number; interval: 'month' | 'year'; description: string }> = {
  START: {
    name: 'Nexus START',
    amount: 2900, // 29€/mês
    interval: 'month',
    description: 'Site profissional + SEO básico + 1 revisão/mês',
  },
  GROWTH: {
    name: 'Nexus GROWTH',
    amount: 9900, // 99€/mês
    interval: 'month',
    description: 'Site avançado + Social Media + SEO completo + Google Ads',
  },
  NEXUS_OS: {
    name: 'Nexus OS Elite',
    amount: 149000, // 1.490€/ano
    interval: 'year',
    description: 'Tudo incluído — Site premium, Social Media diário, Ads, SEO, WhatsApp AI, Automação',
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
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const userEmail = user.email!;

    // Parse request body
    const { planType, projectId, successUrl, cancelUrl } = await req.json();

    if (!planType || !PLAN_CONFIG[planType]) {
      return new Response(JSON.stringify({ error: 'Invalid plan type. Use START, GROWTH, or NEXUS_OS.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!projectId) {
      return new Response(JSON.stringify({ error: 'Project ID is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const plan = PLAN_CONFIG[planType];

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Check if user already has a Stripe customer
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
    }

    // Create the checkout session with embedded pricing
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      locale: 'pt',
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: plan.amount,
            recurring: { interval: plan.interval },
            product_data: {
              name: plan.name,
              description: plan.description,
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          project_id: projectId,
          user_id: userId,
          plan_type: planType,
        },
      },
      metadata: {
        project_id: projectId,
        user_id: userId,
        plan_type: planType,
      },
      success_url: successUrl || `${req.headers.get('origin') || 'https://marketing-ai-core.lovable.app'}/strategy?checkout=success`,
      cancel_url: cancelUrl || `${req.headers.get('origin') || 'https://marketing-ai-core.lovable.app'}/strategy?checkout=cancel`,
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
