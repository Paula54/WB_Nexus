import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const META_APP_ID = Deno.env.get("META_APP_ID");
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET");
    const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!META_APP_ID || !META_APP_SECRET || !META_ACCESS_TOKEN) {
      throw new Error("Meta credentials not configured");
    }

    // Step 1: Exchange for long-lived token
    const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${META_ACCESS_TOKEN}`;

    const tokenResponse = await fetch(exchangeUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Token exchange error:", tokenData.error);
      return new Response(
        JSON.stringify({ success: false, error: tokenData.error.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const longLivedToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in; // seconds (typically ~5184000 = 60 days)

    // Step 2: Get Instagram Business Account ID
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${longLivedToken}`
    );
    const pagesData = await pagesResponse.json();

    let instagramAccountId: string | null = null;
    let instagramUsername: string | null = null;
    let pageId: string | null = null;

    if (pagesData.data && pagesData.data.length > 0) {
      for (const page of pagesData.data) {
        if (page.instagram_business_account) {
          instagramAccountId = page.instagram_business_account.id;
          instagramUsername = page.instagram_business_account.username || null;
          pageId = page.id;
          break;
        }
      }
    }

    // Step 3: Get Ad Account ID
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${longLivedToken}`
    );
    const adAccountsData = await adAccountsResponse.json();

    let adAccountId: string | null = null;
    if (adAccountsData.data && adAccountsData.data.length > 0) {
      adAccountId = adAccountsData.data[0].id; // e.g. "act_123456"
    }

    // Step 4: Store in the user's project
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the project with Meta credentials
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: updateError } = await adminClient
      .from("projects")
      .update({
        meta_access_token: longLivedToken,
        meta_ads_account_id: adAccountId,
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error updating project:", updateError);
    }

    const expiresAt = new Date(Date.now() + (expiresIn || 5184000) * 1000).toISOString();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Token trocado com sucesso!",
        long_lived_token_expires: expiresAt,
        instagram_account_id: instagramAccountId,
        instagram_username: instagramUsername,
        page_id: pageId,
        ad_account_id: adAccountId,
        ad_accounts_count: adAccountsData.data?.length || 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("meta-token-exchange error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
