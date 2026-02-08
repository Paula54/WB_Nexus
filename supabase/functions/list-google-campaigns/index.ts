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

    // === TEMPORARY: Validate OAuth bridge via listAccessibleCustomers ===
    const endpoint = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`;
    console.log(`[bridge-test] Endpoint: ${endpoint}`);

    const adsResponse = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "developer-token": DEVELOPER_TOKEN,
      },
    });

    const rawBody = await adsResponse.text();
    console.log(`[bridge-test] Status: ${adsResponse.status}, Content-Type: ${adsResponse.headers.get("content-type")}`);
    console.log(`[bridge-test] Body preview: ${rawBody.substring(0, 500)}`);

    if (!adsResponse.ok) {
      // Check for specific token issues
      let diagnosticMsg = `HTTP ${adsResponse.status} da API Google Ads`;
      if (rawBody.includes("DEVELOPER_TOKEN_PROHIBITED")) {
        diagnosticMsg = "DEVELOPER_TOKEN_PROHIBITED — O Developer Token não tem permissão. Verifica o estado no Google Ads API Center.";
      } else if (rawBody.includes("UNAUTHENTICATED")) {
        diagnosticMsg = "UNAUTHENTICATED — O access_token é inválido ou expirou. Tenta reconectar a conta Google.";
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

    // Parse accessible customers
    const responseData = adsData as Record<string, unknown>;
    const resourceNames = (responseData.resourceNames || []) as string[];
    const accessibleIds = resourceNames.map((r) => r.replace("customers/", ""));

    return new Response(
      JSON.stringify({
        success: true,
        customer_id: account.google_ads_customer_id || "N/A",
        total: accessibleIds.length,
        campaigns: accessibleIds.map((id) => ({
          id,
          name: `Conta acessível: ${id}`,
          status: "ACCESSIBLE",
        })),
        _bridge_test: true,
        _message: `Ponte Validada! O teu acesso foi confirmado para ${accessibleIds.length} conta(s): ${accessibleIds.join(", ")}`,
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
