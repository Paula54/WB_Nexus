import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FB_AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // CRITICAL: redirect_uri MUST match exactly what's registered in Meta App Settings.
    // Force production URL so the callback always lands on the prod project — never on Lovable Cloud.
    const PROD_SUPABASE_URL = "https://hqyuxponbobmuletqshq.supabase.co";
    const SUPABASE_URL = Deno.env.get("PROD_SUPABASE_URL") || PROD_SUPABASE_URL;
    const SERVICE_KEY = Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to get meta_client_id from project_credentials first
    let META_APP_ID = "";
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: creds } = await supabaseAdmin
      .from("project_credentials")
      .select("meta_client_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (creds?.meta_client_id) {
      META_APP_ID = creds.meta_client_id;
      console.log("Using meta_client_id from project_credentials");
    } else {
      // Fallback to env vars
      META_APP_ID = (
        Deno.env.get("META_APP_ID") ||
        Deno.env.get("FACEBOOK_APP_ID") ||
        Deno.env.get("NEXT_PUBLIC_FB_APP_ID") ||
        Deno.env.get("VITE_FACEBOOK_APP_ID") ||
        ""
      ).trim();
      console.log("Using meta_client_id from env vars");
    }

    const META_APP_SECRET_PRESENT = !!(Deno.env.get("META_APP_SECRET") || Deno.env.get("FACEBOOK_APP_SECRET"));

    console.log("🔍 [meta-ads-auth] Diagnóstico de credenciais:", {
      META_APP_ID_present: !!META_APP_ID,
      META_APP_ID_length: META_APP_ID.length,
      META_APP_ID_preview: META_APP_ID ? `${META_APP_ID.slice(0, 4)}...${META_APP_ID.slice(-4)}` : "VAZIO",
      META_APP_SECRET_present: META_APP_SECRET_PRESENT,
      SUPABASE_URL,
      source: creds?.meta_client_id ? "project_credentials" : "env_vars",
    });

    if (!META_APP_ID) {
      console.error("❌ META_APP_ID not configured anywhere");
      return new Response(
        JSON.stringify({ error: "A configuração da aplicação Meta não está disponível. Contacte o suporte." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!META_APP_SECRET_PRESENT) {
      console.error("❌ META_APP_SECRET ausente — callback irá falhar na troca do code por token");
    }

    const requestUrl = new URL(req.url);
    const returnOrigin = requestUrl.searchParams.get("return_origin") || "";
    const requestOrigin = req.headers.get("origin") || req.headers.get("referer") || "(none)";

    // EXACT redirect_uri registered in Meta App > Facebook Login > Valid OAuth Redirect URIs
    const redirectUri = `${SUPABASE_URL}/functions/v1/meta-ads-callback`;

    // Validate client_id one more time right before building the URL
    if (!META_APP_ID || META_APP_ID.length < 10) {
      console.error("❌ [meta-ads-auth] META_APP_ID inválido no momento de gerar a URL:", META_APP_ID);
      return new Response(
        JSON.stringify({ error: "client_id (META_APP_ID) inválido ou ausente. Verifique a Secret no Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const state = `${user.id}|${returnOrigin}`;

    const params = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "ads_management,ads_read,pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish,business_management",
      state,
    });

    const authUrl = `${FB_AUTH_URL}?${params.toString()}`;

    console.log("🔗 [meta-ads-auth] OAuth URL gerada:", {
      redirect_uri: redirectUri,
      redirect_uri_length: redirectUri.length,
      request_origin: requestOrigin,
      return_origin: returnOrigin,
      user_id: user.id,
      auth_url_preview: authUrl.slice(0, 200) + "...",
    });
    console.log("⚠️ [meta-ads-auth] CONFIRMA na Meta App > Facebook Login > Valid OAuth Redirect URIs:");
    console.log(`   ${redirectUri}`);

    return new Response(
      JSON.stringify({ auth_url: authUrl, debug: { redirect_uri: redirectUri, app_id_preview: `${META_APP_ID.slice(0, 4)}...${META_APP_ID.slice(-4)}` } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("meta-ads-auth error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
