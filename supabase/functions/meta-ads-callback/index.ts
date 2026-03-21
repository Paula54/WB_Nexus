import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../_shared/crypto.ts";

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
    const META_APP_ID = Deno.env.get("META_APP_ID")!;
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET")!;

    // Production credentials
    const PROD_URL = Deno.env.get("PROD_SUPABASE_URL")!;
    const PROD_KEY = Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY")!;

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

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

    // Step 4: Fetch Facebook Pages to get facebook_page_id
    let facebookPageId: string | null = null;
    let facebookPageName: string | null = null;
    try {
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${longLivedToken}`
      );
      const pagesData = await pagesResponse.json();
      if (pagesData.data && pagesData.data.length > 0) {
        facebookPageId = pagesData.data[0].id;
        facebookPageName = pagesData.data[0].name;
        console.log(`Facebook Page found: ${facebookPageName} (${facebookPageId})`);
      } else {
        console.log("No Facebook Pages found for this user");
      }
    } catch (pageErr) {
      console.error("Error fetching Facebook Pages:", pageErr);
    }

    // Encrypt the token before storing
    const encryptedToken = await encryptToken(longLivedToken);

    // Use PRODUCTION Supabase for persistence
    const prodClient = createClient(PROD_URL, PROD_KEY);

    // Build update payload
    const updatePayload: Record<string, any> = {
      meta_access_token: encryptedToken,
    };

    // If only one ad account, auto-select it
    if (adAccounts.length === 1) {
      updatePayload.meta_ads_account_id = adAccounts[0].id;
    } else {
      updatePayload.meta_ads_account_id = null;
    }

    // Store facebook_page_id if available
    if (facebookPageId) {
      updatePayload.facebook_page_id = facebookPageId;
    }

    const { error: updateError } = await prodClient
      .from("projects")
      .update(updatePayload)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error updating production project:", updateError.message);
      return Response.redirect(`${returnUrl}?meta_ads_error=${encodeURIComponent("Erro ao gravar dados: " + updateError.message)}`, 302);
    }

    console.log(`✅ Meta connected for user ${userId} on PRODUCTION (page: ${facebookPageId})`);

    if (adAccounts.length === 1) {
      const successUrl = `${returnUrl}?meta_ads_connected=true&meta_account_name=${encodeURIComponent(adAccounts[0].name || adAccounts[0].id)}`;
      return Response.redirect(successUrl, 302);
    }

    // Multiple accounts: let user pick
    const accountsParam = encodeURIComponent(JSON.stringify(adAccounts));
    const pickUrl = `${returnUrl}?meta_ads_pick_account=true&meta_accounts=${accountsParam}`;
    return Response.redirect(pickUrl, 302);
  } catch (err) {
    console.error("meta-ads-callback error:", err);
    const fallbackUrl = "https://marketing-ai-core.lovable.app/settings?meta_ads_error=Erro+interno+no+servidor";
    return Response.redirect(fallbackUrl, 302);
  }
});
