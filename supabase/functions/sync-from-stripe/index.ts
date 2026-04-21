import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * sync-from-stripe
 * Pulls billing data from Stripe (name, NIF/tax_id, address) and fills empty
 * fields on the user's primary project. Never overwrites data already present.
 */
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

    // Production project (where the user actually exists) — NOT the Lovable Cloud env vars
    const prodSupabaseUrl = Deno.env.get("PROD_SUPABASE_URL") ?? "https://hqyuxponbobmuletqshq.supabase.co";
    const prodServiceKey = Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY")!;

    if (!prodServiceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(prodSupabaseUrl, prodServiceKey);

    // Validate the JWT against the production project using the service role
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await admin.auth.getUser(token);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user?.email) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: false, reason: "no_stripe_customer" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const customer = customers.data[0];

    // Fetch tax IDs (NIF stored as eu_vat: PT123456789)
    let nifFromStripe: string | null = null;
    try {
      const taxIds = await stripe.customers.listTaxIds(customer.id, { limit: 5 });
      const ptVat = taxIds.data.find((t: any) => t.type === "eu_vat" && typeof t.value === "string" && t.value.startsWith("PT"));
      if (ptVat) nifFromStripe = (ptVat.value as string).replace(/^PT/, "");
    } catch (_) { /* non-blocking */ }

    // Get user's primary project
    const { data: project } = await admin
      .from("projects")
      .select("id, legal_name, business_name, nif, address_line1, postal_code, city, country, phone")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!project) {
      return new Response(
        JSON.stringify({ success: true, synced: false, reason: "no_project" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build patch — only fill empty fields
    const meta = (customer.metadata || {}) as Record<string, string>;
    const addr = customer.address || ({} as any);
    const patch: Record<string, unknown> = {};

    const setIfEmpty = (key: string, value: string | null | undefined) => {
      if (!value) return;
      const current = (project as any)[key];
      if (current == null || String(current).trim() === "") patch[key] = value;
    };

    setIfEmpty("legal_name", meta.legal_name || customer.name || null);
    setIfEmpty("business_name", meta.company_name || meta.legal_name || customer.name || null);
    setIfEmpty("nif", nifFromStripe || meta.nif || null);
    setIfEmpty("phone", customer.phone || null);
    setIfEmpty("address_line1", addr.line1 || null);
    setIfEmpty("postal_code", addr.postal_code || null);
    setIfEmpty("city", addr.city || null);
    setIfEmpty("country", addr.country === "PT" ? "Portugal" : (addr.country || null));

    if (Object.keys(patch).length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: false, reason: "already_filled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateError } = await admin
      .from("projects")
      .update(patch)
      .eq("id", project.id);

    if (updateError) {
      console.error("sync-from-stripe update error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, synced: true, fields: Object.keys(patch) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-from-stripe error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
