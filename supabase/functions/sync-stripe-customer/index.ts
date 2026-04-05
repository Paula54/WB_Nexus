import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { legal_name, trade_name, nif, address_line1, address_line2, postal_code, city, country, phone, email, full_name, company_name } = body;

    // Data mapping:
    // full_name → client's personal name (for Stripe customer name)
    // company_name / trade_name / legal_name → company name (for Stripe metadata)
    // nif → tax_id only (NOT stored in name fields)
    const customerDisplayName = full_name || legal_name || undefined;
    const companyDisplayName = company_name || trade_name || legal_name || undefined;

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const userEmail = email || user.email;

    // Find existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      // Create customer if doesn't exist
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
    }

    // Update customer with fiscal data
    await stripe.customers.update(customerId, {
      name: legal_name || undefined,
      phone: phone || undefined,
      address: {
        line1: address_line1 || "",
        line2: address_line2 || "",
        postal_code: postal_code || "",
        city: city || "",
        country: country === "Portugal" ? "PT" : country || "PT",
      },
      metadata: {
        user_id: user.id,
        nif: nif || "",
        legal_name: legal_name || "",
      },
      tax_id_data: undefined, // We'll add tax ID separately
    });

    // Add or update VAT tax ID if NIF provided
    if (nif && nif.length === 9) {
      try {
        // List existing tax IDs
        const existingTaxIds = await stripe.customers.listTaxIds(customerId, { limit: 10 });
        
        // Check if this NIF is already registered
        const vatId = `PT${nif}`;
        const alreadyExists = existingTaxIds.data.some(
          (tid: any) => tid.type === "eu_vat" && tid.value === vatId
        );

        if (!alreadyExists) {
          // Delete old eu_vat entries
          for (const tid of existingTaxIds.data) {
            if (tid.type === "eu_vat") {
              await stripe.customers.deleteTaxId(customerId, tid.id);
            }
          }
          // Add new one
          await stripe.customers.createTaxId(customerId, {
            type: "eu_vat",
            value: vatId,
          });
        }
      } catch (taxErr) {
        console.warn("Tax ID sync warning:", taxErr);
        // Non-blocking — the rest of the sync succeeded
      }
    }

    return new Response(
      JSON.stringify({ success: true, stripe_customer_id: customerId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-stripe-customer error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
