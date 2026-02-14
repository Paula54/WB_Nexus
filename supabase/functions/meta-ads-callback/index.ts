import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const META_APP_ID = Deno.env.get("META_APP_ID")!;
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET")!;

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
      console.error("Meta OAuth error:", error);
      return Response.redirect(`${returnUrl}?meta_ads_error=${encodeURIComponent(error)}`, 302);
    }

    if (!code || !userId) {
      return Response.redirect(`${returnUrl}?meta_ads_error=${encodeURIComponent("Parâmetros em falta.")}`, 302);
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/meta-ads-callback`;

    // Step 1: Exchange code for short-lived token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${META_APP_SECRET}&code=${code}`
    );
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Meta token exchange error:", tokenData.error);
      return Response.redirect(`${returnUrl}?meta_ads_error=${encodeURIComponent(tokenData.error.message)}`, 302);
    }

    const shortLivedToken = tokenData.access_token;

    // Step 2: Exchange for long-lived token
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`
    );
    const longLivedData = await longLivedResponse.json();
    const longLivedToken = longLivedData.access_token || shortLivedToken;

    // Step 3: Fetch ad accounts
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${longLivedToken}`
    );
    const adAccountsData = await adAccountsResponse.json();

    const adAccounts = (adAccountsData.data || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      status: a.account_status,
    }));

    // Step 4: Store token temporarily and redirect with ad accounts info
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // If only one ad account, auto-select it
    if (adAccounts.length === 1) {
      await adminClient
        .from("projects")
        .update({
          meta_access_token: longLivedToken,
          meta_ads_account_id: adAccounts[0].id,
        })
        .eq("user_id", userId);

      const successUrl = `${returnUrl}?meta_ads_connected=true&meta_account_name=${encodeURIComponent(adAccounts[0].name || adAccounts[0].id)}`;
      return Response.redirect(successUrl, 302);
    }

    // Multiple accounts: store token, let user pick
    await adminClient
      .from("projects")
      .update({
        meta_access_token: longLivedToken,
        meta_ads_account_id: null, // will be set after user picks
      })
      .eq("user_id", userId);

    const accountsParam = encodeURIComponent(JSON.stringify(adAccounts));
    const pickUrl = `${returnUrl}?meta_ads_pick_account=true&meta_accounts=${accountsParam}`;
    return Response.redirect(pickUrl, 302);
  } catch (err) {
    console.error("meta-ads-callback error:", err);
    const fallbackUrl = "https://marketing-ai-core.lovable.app/settings?meta_ads_error=Erro+interno+no+servidor";
    return Response.redirect(fallbackUrl, 302);
  }
});
