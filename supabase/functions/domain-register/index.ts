import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const { domain, finalPrice, costPrice } = await req.json();

    if (!domain || !finalPrice || !costPrice) {
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

    if (balance < finalPrice) {
      return new Response(
        JSON.stringify({ error: "Saldo insuficiente na Wallet", balance, required: finalPrice }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== MOCK MODE ==========
    // No real Porkbun registration — simulates success
    console.log(`[MOCK] Domain registration simulated for: ${domain}`);

    // Debit wallet
    await adminClient.from("wallet_transactions").insert({
      user_id: user.id,
      amount: -finalPrice,
      type: "domain_purchase",
      description: `Registo de domínio: ${domain}`,
      reference_id: domain,
    });

    // Save domain registration (mock) — 1 year expiry
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    await adminClient.from("domain_registrations").insert({
      user_id: user.id,
      domain_name: domain,
      status: "active",
      purchase_price: finalPrice,
      cost_price: costPrice,
      porkbun_id: `mock-${Date.now()}`,
      nameservers: ["ns1.porkbun.com", "ns2.porkbun.com"],
      expiry_date: expiryDate.toISOString(),
    });

    // Cashback: credit 15€ back to user wallet
    const CASHBACK_AMOUNT = 15.0;
    await adminClient.from("wallet_transactions").insert({
      user_id: user.id,
      amount: CASHBACK_AMOUNT,
      type: "cashback",
      description: `Cashback pelo registo de ${domain}`,
      reference_id: domain,
    });

    return new Response(
      JSON.stringify({
        success: true,
        domain,
        mock: true,
        message: `[DEMO] Domínio ${domain} registado com sucesso! +${CASHBACK_AMOUNT}€ cashback.`,
        newBalance: balance - finalPrice + CASHBACK_AMOUNT,
        cashback: CASHBACK_AMOUNT,
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
