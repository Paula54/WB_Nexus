import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

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

    const url = new URL(req.url);

    // ── ACTION: Generate OAuth URL ──
    if (req.method === "GET") {
      const redirectUri = url.searchParams.get("redirect_uri");
      if (!redirectUri) {
        return new Response(
          JSON.stringify({ error: "redirect_uri is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/adwords openid email",
        access_type: "offline",
        prompt: "consent",
        state: user.id,
      });

      const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

      return new Response(
        JSON.stringify({ auth_url: authUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: Exchange code for tokens ──
    if (req.method === "POST") {
      const { code, redirect_uri } = await req.json();

      if (!code || !redirect_uri) {
        return new Response(
          JSON.stringify({ error: "code and redirect_uri are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Exchange authorization code for tokens
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        console.error("Google token error:", tokenData);
        return new Response(
          JSON.stringify({ error: `Google OAuth: ${tokenData.error_description || tokenData.error}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { refresh_token, access_token } = tokenData;

      if (!refresh_token) {
        return new Response(
          JSON.stringify({ error: "No refresh_token received. Please revoke access and try again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get Google email
      let googleEmail = "";
      try {
        const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        const userInfo = await userInfoRes.json();
        googleEmail = userInfo.email || "";
      } catch (e) {
        console.warn("Could not fetch Google user info:", e);
      }

      // Store in database using service role
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Upsert: one active account per user
      const { data: existing } = await adminClient
        .from("google_ads_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (existing) {
        await adminClient
          .from("google_ads_accounts")
          .update({
            google_refresh_token: refresh_token,
            google_email: googleEmail,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await adminClient
          .from("google_ads_accounts")
          .insert({
            user_id: user.id,
            google_refresh_token: refresh_token,
            google_email: googleEmail,
          });
      }

      return new Response(
        JSON.stringify({
          success: true,
          google_email: googleEmail,
          message: "Conta Google Ads ligada com sucesso!",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("google-ads-auth error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
