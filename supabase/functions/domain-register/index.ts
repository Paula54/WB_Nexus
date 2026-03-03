import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HOSTINGER_API_BASE = "https://developers.hostinger.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const HOSTINGER_API_TOKEN = Deno.env.get("HOSTINGER_API_TOKEN");

    if (!HOSTINGER_API_TOKEN) {
      throw new Error("HOSTINGER_API_TOKEN not configured");
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { domain, price } = await req.json();

    if (!domain || !price) {
      return new Response(
        JSON.stringify({ error: "Dados em falta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check wallet balance
    const { data: transactions } = await adminClient
      .from("wallet_transactions")
      .select("amount")
      .eq("user_id", user.id);

    const balance = (transactions || []).reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

    if (balance < price) {
      return new Response(
        JSON.stringify({ error: "Saldo insuficiente na Wallet", balance, required: price }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Register domain via Hostinger API
    const registerRes = await fetch(`${HOSTINGER_API_BASE}/api/domains/v1/portfolio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HOSTINGER_API_TOKEN}`,
      },
      body: JSON.stringify({
        domain,
        payment_method_id: null, // Uses default payment method on Hostinger account
      }),
    });

    if (!registerRes.ok) {
      const errorText = await registerRes.text();
      console.error(`Hostinger register error [${registerRes.status}]:`, errorText);
      throw new Error(`Erro ao registar domínio na Hostinger: ${registerRes.status}`);
    }

    const registerData = await registerRes.json();
    console.log("Hostinger register response:", JSON.stringify(registerData));

    // Debit wallet
    await adminClient.from("wallet_transactions").insert({
      user_id: user.id,
      amount: -price,
      type: "domain_purchase",
      description: `Registo de domínio: ${domain}`,
      reference_id: domain,
    });

    // Save domain registration — 1 year expiry
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    await adminClient.from("domain_registrations").insert({
      user_id: user.id,
      domain_name: domain,
      status: "active",
      purchase_price: price,
      cost_price: price,
      porkbun_id: registerData.id || `hostinger-${Date.now()}`,
      nameservers: registerData.nameservers || ["ns1.hostinger.com", "ns2.hostinger.com"],
      expiry_date: registerData.expiry_date || expiryDate.toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        domain,
        message: `Domínio ${domain} registado com sucesso!`,
        newBalance: balance - price,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("domain-register error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
