import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ADS_API_VERSION = "v18";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const DEVELOPER_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;

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
      .select("google_refresh_token, google_ads_customer_id")
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

    const accessToken = tokenData.access_token;

    // Remove hyphens from customer ID for API call
    const customerId = account.google_ads_customer_id.replace(/-/g, "");
    console.log(`A iniciar chamada para o Customer ID: ${account.google_ads_customer_id} (${customerId})`);

    // Call Google Ads API to list campaigns
    const query = `
      SELECT 
        campaign.id, 
        campaign.name, 
        campaign.status,
        campaign.advertising_channel_type,
        campaign_budget.amount_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros
      FROM campaign 
      ORDER BY campaign.id
      LIMIT 50
    `;

    const adsResponse = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "developer-token": DEVELOPER_TOKEN,
        },
        body: JSON.stringify({ query }),
      }
    );

    // Read raw text first to avoid JSON parse errors on HTML responses
    const rawBody = await adsResponse.text();
    console.log(`Google Ads API status: ${adsResponse.status}, content-type: ${adsResponse.headers.get("content-type")}`);

    let adsData: unknown;
    try {
      adsData = JSON.parse(rawBody);
    } catch {
      console.error("Google Ads API returned non-JSON:", rawBody.substring(0, 500));
      
      // Check for common HTML error patterns
      let friendlyError = "A API do Google Ads devolveu uma resposta inesperada.";
      if (rawBody.includes("DEVELOPER_TOKEN") || rawBody.includes("developer-token")) {
        friendlyError = "O Developer Token do Google Ads não é válido ou ainda está em modo de teste.";
      } else if (adsResponse.status === 403) {
        friendlyError = "Acesso negado pela API do Google Ads. Verifica se o Developer Token está aprovado.";
      } else if (adsResponse.status === 401) {
        friendlyError = "Token de acesso expirado ou inválido. Tenta reconectar a conta Google Ads.";
      }
      
      return new Response(
        JSON.stringify({
          error: friendlyError,
          details: { status: adsResponse.status, body_preview: rawBody.substring(0, 300) },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!adsResponse.ok) {
      console.error("Google Ads API error:", JSON.stringify(adsData));
      
      // Check for developer token issues
      const errorDetails = adsData as Record<string, unknown>;
      const errorStr = JSON.stringify(adsData);
      let errorMessage = "Erro ao consultar a API do Google Ads.";
      
      if (errorStr.includes("DEVELOPER_TOKEN_PROHIBITED") || errorStr.includes("NOT_APPROVED")) {
        errorMessage = "O teu Developer Token do Google Ads ainda está em modo de teste ou aguarda aprovação pela Google.";
      } else {
        errorMessage =
          (errorDetails?.error as Record<string, string>)?.message ||
          ((adsData as Array<Record<string, Record<string, string>>>)?.[0]?.error?.message) ||
          errorMessage;
      }
      
      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: adsData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the stream response — searchStream returns an array of result batches
    const campaigns: Array<Record<string, unknown>> = [];

    if (Array.isArray(adsData)) {
      for (const batch of adsData) {
        if (batch.results) {
          for (const result of batch.results) {
            campaigns.push({
              id: result.campaign?.id,
              name: result.campaign?.name,
              status: result.campaign?.status,
              channel_type: result.campaign?.advertisingChannelType,
              budget_micros: result.campaignBudget?.amountMicros,
              impressions: result.metrics?.impressions,
              clicks: result.metrics?.clicks,
              cost_micros: result.metrics?.costMicros,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        customer_id: account.google_ads_customer_id,
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
