import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FB_AUTH_URL = "https://www.facebook.com/v24.0/dialog/oauth";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PROD_SUPABASE_URL = "https://hqyuxponbobmuletqshq.supabase.co";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || PROD_SUPABASE_URL;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // 1. Verificar Autenticação do Usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Invalid user token");

    // 2. Obter META_APP_ID (Sem duplicações!)
    const META_APP_ID = (
      Deno.env.get("META_APP_ID") || 
      "1578338553386945" // O teu ID da App Meta que vi no PDF
    ).trim();

    // 3. Gerar URL de Redirecionamento
    const redirectUri = `${SUPABASE_URL}/functions/v1/meta-ads-callback`;
    const requestUrl = new URL(req.url);
    const returnOrigin = requestUrl.searchParams.get("return_origin") || "";
    const state = btoa(JSON.stringify({ userId: user.id, origin: returnOrigin }));

    const params = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "ads_management,ads_read,pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish,business_management",
      state: state,
    });

    const authUrl = `${FB_AUTH_URL}?${params.toString()}`;

    console.log("✅ URL Gerada com sucesso para v24.0:", authUrl);

    return new Response(
      JSON.stringify({ auth_url: authUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Erro na função:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});