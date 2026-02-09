import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GOOGLE_CLIENT_ID = (Deno.env.get("GOOGLE_ADS_CLIENT_ID") || "").trim();
    const GOOGLE_CLIENT_SECRET = (Deno.env.get("GOOGLE_ADS_CLIENT_SECRET") || "").trim();

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Parse state: "user_id|return_origin"
    let userId = "";
    let returnOrigin = "";

    if (state) {
      const parts = state.split("|");
      userId = parts[0] || "";
      returnOrigin = parts[1] || "";
    }

    const returnUrl = returnOrigin
      ? `${returnOrigin}/settings`
      : "https://marketing-ai-core.lovable.app/settings";

    if (error) {
      console.error("Google OAuth error:", error);
      const errorUrl = `${returnUrl}?google_ads_error=${encodeURIComponent(error)}`;
      return Response.redirect(errorUrl, 302);
    }

    if (!code || !userId) {
      const errorUrl = `${returnUrl}?google_ads_error=${encodeURIComponent("Parâmetros em falta (code ou state).")}`;
      return Response.redirect(errorUrl, 302);
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-ads-callback`;

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Google token exchange error:", tokenData);
      const errorMsg = tokenData.error_description || tokenData.error;
      const errorUrl = `${returnUrl}?google_ads_error=${encodeURIComponent(errorMsg)}`;
      return Response.redirect(errorUrl, 302);
    }

    const { refresh_token, access_token } = tokenData;

    if (!refresh_token) {
      const errorUrl = `${returnUrl}?google_ads_error=${encodeURIComponent("Nenhum refresh_token recebido. Revoga o acesso em myaccount.google.com e tenta novamente.")}`;
      return Response.redirect(errorUrl, 302);
    }

    // Get Google email for display
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

    const { data: existing } = await adminClient
      .from("google_ads_accounts")
      .select("id")
      .eq("user_id", userId)
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
          user_id: userId,
          google_refresh_token: refresh_token,
          google_email: googleEmail,
        });
    }

    const successUrl = `${returnUrl}?google_ads_connected=true&google_email=${encodeURIComponent(googleEmail)}`;
    return Response.redirect(successUrl, 302);
  } catch (err) {
    console.error("google-ads-callback error:", err);
    const fallbackUrl = "https://marketing-ai-core.lovable.app/settings?google_ads_error=Erro+interno+no+servidor";
    return Response.redirect(fallbackUrl, 302);
  }
});
