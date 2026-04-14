import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const SUPABASE_URL = Deno.env.get("PROD_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida. Faça login novamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Sessão expirada. Faça login novamente." }),
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
        Deno.env.get("NEXT_PUBLIC_FB_APP_ID") ||
        Deno.env.get("VITE_FACEBOOK_APP_ID") ||
        ""
      ).trim();
      console.log("Using meta_client_id from env vars");
    }

    if (!META_APP_ID) {
      console.error("META_APP_ID not configured anywhere");
      return new Response(
        JSON.stringify({ error: "A configuração da aplicação Meta não está disponível. Contacte o suporte." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestUrl = new URL(req.url);
    const returnOrigin = requestUrl.searchParams.get("return_origin") || "";

    const redirectUri = `${SUPABASE_URL}/functions/v1/meta-ads-callback`;

    const state = `${user.id}|${returnOrigin}`;

    const params = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "ads_management,ads_read,pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish,business_management",
      state,
    });

    const authUrl = `${FB_AUTH_URL}?${params.toString()}`;

    return new Response(
      JSON.stringify({ auth_url: authUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("meta-ads-auth error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
