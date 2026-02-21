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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const META_APP_ID = Deno.env.get("META_APP_ID")!;

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

    const requestUrl = new URL(req.url);
    const returnOrigin = requestUrl.searchParams.get("return_origin") || "";

    const redirectUri = `${SUPABASE_URL}/functions/v1/meta-ads-callback`;

    // state carries user_id and return_origin
    const state = `${user.id}|${returnOrigin}`;

    const params = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "ads_management,ads_read,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,business_management",
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
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
