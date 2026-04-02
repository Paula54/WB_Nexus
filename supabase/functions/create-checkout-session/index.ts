// Update deploy v1.1

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// New Elite White Label pricing with setup fees
const PLAN_CONFIG: Record<
  string,
  {
    name: string;
    subscription_price_id: string;
    setup_price_id: string;
    description: string;
  }
> = {
  START: {
    name: "Nexus Start",
    subscription_price_id: "price_1TDWcVE6rYpESbYpc6Pv0Gp6",
    setup_price_id: "price_1TDWH1E6rYpESbYpH1HEB8pY",
    description: "SEO e Validação — 49€/mês + Taxa de Ativação 790€",
  },
  GROWTH: {
    name: "Nexus Growth",
    subscription_price_id: "price_1TDWfxE6rYpESbYpuWFi5qnL",
    setup_price_id: "price_1TDWIjE6rYpESbYpkkajePcW",
    description: "Blog IA, Ads e Newsletters — 149€/mês + Taxa de Ativação 1.490€",
  },
  NEXUS_OS: {
    name: "Nexus OS",
    subscription_price_id: "price_1TDWwyE6rYpESbYpHEHNEeAG",
    setup_price_id: "price_1TDWJPE6rYpESbYpbzTCDw0h",
    description: "WhatsApp AI, CRM e Gestão Total — 299€/mês + Taxa de Ativação 2.490€",
  },
};
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;
    const { planType, projectId, successUrl, cancelUrl } = await req.json();

    // Fetch profile data for prefilling checkout
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: bizData } = await supabase
      .from("business_profiles")
      .select("phone")
      .eq("user_id", user.id)
      .maybeSingle();

    const customerName = profileData?.full_name || undefined;
    const customerPhone = bizData?.phone || undefined;

    if (!planType || !PLAN_CONFIG[planType]) {
      return new Response(JSON.stringify({ error: "Invalid plan type. Use START, GROWTH, or NEXUS_OS." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!projectId) {
      return new Response(JSON.stringify({ error: "Project ID is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plan = PLAN_CONFIG[planType];
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

    // Find or create customer
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Checkout with subscription + one-time setup fee in a single session
    // If existing customer, update name/phone on Stripe customer object
    if (customerId && (customerName || customerPhone)) {
      await stripe.customers.update(customerId, {
        ...(customerName ? { name: customerName } : {}),
        ...(customerPhone ? { phone: customerPhone } : {}),
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      ...(customerId
        ? {}
        : {
            customer_creation: "always",
          }),
      locale: "pt",
      mode: "subscription",
      payment_method_types: ["card"],
      phone_number_collection: { enabled: true },
      line_items: [
        { price: plan.subscription_price_id, quantity: 1 },
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
      success_url: "https://nexus.web-business.pt/success",
      cancel_url: "https://nexus.web-business.pt/planos",
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error creating checkout session:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
