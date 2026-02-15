import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ADS_API_VERSION = "v23";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GOOGLE_CLIENT_ID = (Deno.env.get("GOOGLE_ADS_CLIENT_ID") || "").trim();
    const GOOGLE_CLIENT_SECRET = (Deno.env.get("GOOGLE_ADS_CLIENT_SECRET") || "").trim();
    const DEVELOPER_TOKEN = (Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") || "").trim();
    const MANAGER_ID = (Deno.env.get("GOOGLE_ADS_MANAGER_ID") || "").replace(/\D/g, "");

    // Verify user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autenticado. Faz login novamente." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Token inválido. Faz logout e login novamente." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Google Ads account from DB
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: account, error: accountError } = await adminClient
      .from("google_ads_accounts")
      .select("google_refresh_token, google_ads_customer_id, mcc_customer_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: "Nenhuma conta Google Ads ligada." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!account.google_ads_customer_id) {
      return new Response(
        JSON.stringify({ error: "Customer ID não configurado. Define-o nas Definições." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean customer ID (keep only digits)
    const cleanCustomerId = account.google_ads_customer_id.replace(/\D/g, "");

    // Refresh the access token
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: account.google_refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Token refresh error:", tokenData);
      return new Response(
        JSON.stringify({
          error: `Erro ao renovar token: ${tokenData.error_description || tokenData.error}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenData.access_token.trim();

    // Use Manager ID from secrets, fallback to DB mcc_customer_id
    const loginCustomerId = MANAGER_ID || (account.mcc_customer_id || "").replace(/\D/g, "");

    // Build endpoint for campaign search
    const endpoint = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cleanCustomerId}/googleAds:search`;
    console.log(`[google-ads] Endpoint: ${endpoint}`);
    console.log(`[google-ads] Customer ID: ${cleanCustomerId}, Login Customer ID: ${loginCustomerId}`);
    console.log(`[google-ads] Developer Token length: ${DEVELOPER_TOKEN.length}`);

    // Build headers — login-customer-id is MANDATORY for MCC hierarchy
    const adsHeaders: Record<string, string> = {
      "Authorization": `Bearer ${accessToken}`,
      "developer-token": DEVELOPER_TOKEN,
      "Content-Type": "application/json",
      "login-customer-id": loginCustomerId || MANAGER_ID,
    };

    console.log(`[google-ads] Headers: developer-token length=${DEVELOPER_TOKEN.length}, login-customer-id=${adsHeaders["login-customer-id"]}`);

    const gaqlQuery = `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign_budget.amount_micros, metrics.impressions, metrics.clicks, metrics.cost_micros FROM campaign ORDER BY campaign.id`;

    const adsResponse = await fetch(endpoint, {
      method: "POST",
      headers: adsHeaders,
      body: JSON.stringify({ query: gaqlQuery }),
    });

    const rawBody = await adsResponse.text();
    console.log(`[google-ads] Status: ${adsResponse.status}`);
    console.log(`[google-ads] Body preview: ${rawBody.substring(0, 500)}`);

    if (!adsResponse.ok) {
      let diagnosticMsg = `HTTP ${adsResponse.status} da API Google Ads`;
      if (rawBody.includes("DEVELOPER_TOKEN_PROHIBITED")) {
        diagnosticMsg = "DEVELOPER_TOKEN_PROHIBITED — O Developer Token não tem permissão. Verifica o estado no Google Ads API Center.";
      } else if (rawBody.includes("UNAUTHENTICATED")) {
        diagnosticMsg = "UNAUTHENTICATED — O access_token é inválido ou expirou. Tenta reconectar a conta Google.";
      } else if (rawBody.includes("CUSTOMER_NOT_FOUND")) {
        diagnosticMsg = "CUSTOMER_NOT_FOUND — O Customer ID não existe ou não está acessível com esta conta.";
      } else if (rawBody.includes("NOT_ADS_USER")) {
        diagnosticMsg = "NOT_ADS_USER — A conta Google autenticada não tem acesso ao Google Ads.";
      } else if (rawBody.includes("USER_PERMISSION_DENIED")) {
        diagnosticMsg = "USER_PERMISSION_DENIED — O utilizador não tem permissão. Verifica se o login-customer-id (MCC) está correto e se a conta tem acesso à subconta.";
      } else if (rawBody.includes("CUSTOMER_NOT_ENABLED")) {
        diagnosticMsg = "CUSTOMER_NOT_ENABLED — A conta Google Ads ainda não está ativa ou foi desativada. Acede ao Google Ads (ads.google.com) e ativa a conta antes de sincronizar.";
      }

      return new Response(
        JSON.stringify({
          error: "Erro Google Ads API",
          status: adsResponse.status,
          message: diagnosticMsg,
          details: rawBody.substring(0, 2000),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the GAQL response
    let adsData: unknown;
    try {
      adsData = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({
          error: "Resposta não-JSON da API Google Ads",
          status: adsResponse.status,
          details: rawBody.substring(0, 2000),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract campaigns from GAQL results
    const responseData = adsData as Record<string, unknown>;
    const results = (responseData.results || []) as Array<Record<string, unknown>>;

    const campaigns = results.map((row) => {
      const campaign = (row.campaign || {}) as Record<string, string>;
      const budget = (row.campaignBudget || {}) as Record<string, string>;
      const metrics = (row.metrics || {}) as Record<string, string>;

      return {
        id: campaign.id || "",
        name: campaign.name || "",
        status: campaign.status || "",
        channel_type: campaign.advertisingChannelType || "",
        budget_micros: budget.amountMicros || "0",
        impressions: metrics.impressions || "0",
        clicks: metrics.clicks || "0",
        cost_micros: metrics.costMicros || "0",
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        customer_id: cleanCustomerId,
        total: campaigns.length,
        campaigns,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("list-google-campaigns error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
