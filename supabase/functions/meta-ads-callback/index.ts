import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function ensurePrimaryProject(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userLabel: string,
  fallbackPlan = "START",
) {
  const { data: existingProject, error: lookupError } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existingProject) {
    return existingProject;
  }

  const { data: newProject, error: createError } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name: `Projeto Nexus OS - ${userLabel}`,
      project_type: "marketing",
      selected_plan: fallbackPlan,
    })
    .select("id")
    .single();

  if (createError || !newProject) {
    throw createError || new Error("Failed to create project");
  }

  return newProject;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const META_APP_ID = (Deno.env.get("META_APP_ID") || Deno.env.get("FACEBOOK_APP_ID") || Deno.env.get("NEXT_PUBLIC_FB_APP_ID") || Deno.env.get("VITE_FACEBOOK_APP_ID") || "").trim();
    const META_APP_SECRET = (Deno.env.get("META_APP_SECRET") || Deno.env.get("FACEBOOK_APP_SECRET") || "").trim();
    const PROD_URL = Deno.env.get("PROD_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const PROD_KEY = Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
      : "https://nexus.web-business.pt/settings";

    if (!META_APP_ID || !META_APP_SECRET) {
      return Response.redirect(`${returnUrl}?meta_ads_error=${encodeURIComponent("Meta app credentials not configured")}`, 302);
    }

    if (error) {
      return Response.redirect(`${returnUrl}?meta_ads_error=${encodeURIComponent(error)}`, 302);
    }
    if (!code || !userId) {
      return Response.redirect(`${returnUrl}?meta_ads_error=${encodeURIComponent("Parâmetros em falta.")}`, 302);
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/meta-ads-callback`;

    // Exchange code for token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${META_APP_SECRET}&code=${code}`
    );
    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      return Response.redirect(`${returnUrl}?meta_ads_error=${encodeURIComponent(tokenData.error.message)}`, 302);
    }

    // Long-lived token
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    );
    const longLivedData = await longLivedResponse.json();
    const longLivedToken = longLivedData.access_token || tokenData.access_token;

    // Fetch ad accounts
    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${longLivedToken}`
    );
    const adAccountsData = await adAccountsRes.json();
    const adAccounts = (adAccountsData.data || []).map((a: any) => ({
      id: a.id, name: a.name, status: a.account_status,
    }));

    // Fetch Facebook Pages + Instagram Business Account
    let facebookPageId: string | null = null;
    let instagramBusinessId: string | null = null;
    try {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name&access_token=${longLivedToken}`
      );
      const pagesData = await pagesRes.json();
      if (pagesData.data?.length > 0) {
        facebookPageId = pagesData.data[0].id;

        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${facebookPageId}?fields=instagram_business_account&access_token=${longLivedToken}`
        );
        const igData = await igRes.json();
        if (igData.instagram_business_account?.id) {
          instagramBusinessId = igData.instagram_business_account.id;
        }
      }
    } catch (e) {
      console.error("Error fetching pages/instagram:", e);
    }

    // WhatsApp from env
    const whatsappBusinessId = Deno.env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID") || null;
    const primaryAdAccountId = adAccounts[0]?.id || null;

    const encryptedToken = await encryptToken(longLivedToken);
    const prodClient = createClient(PROD_URL, PROD_KEY);

    const project = await ensurePrimaryProject(prodClient, userId, userId.slice(0, 8));

    await prodClient
      .from("project_credentials")
      .upsert({
        project_id: project.id,
        user_id: userId,
        meta_access_token: encryptedToken,
        meta_ads_account_id: primaryAdAccountId,
        facebook_page_id: facebookPageId,
        instagram_business_id: instagramBusinessId,
        whatsapp_business_id: whatsappBusinessId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "project_id" });

    await prodClient
      .from("projects")
      .update({
        meta_access_token: encryptedToken,
        meta_ads_account_id: primaryAdAccountId,
        facebook_page_id: facebookPageId,
        instagram_business_id: instagramBusinessId,
        whatsapp_business_id: whatsappBusinessId,
      })
      .eq("id", project.id);

    // Fetch pages for selection
    let pages: any[] = [];
    try {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${longLivedToken}`
      );
      const pagesData = await pagesRes.json();
      pages = (pagesData.data || []).map((p: any) => ({
        id: p.id, name: p.name,
        ig_id: p.instagram_business_account?.id || null,
      }));
    } catch (e) {
      console.error("Error fetching pages:", e);
    }

    console.log(`✅ Meta connected for user ${userId} (pages=${pages.length}, adAccounts=${adAccounts.length})`);

    const accountsParam = encodeURIComponent(JSON.stringify(adAccounts));
    const pagesParam = encodeURIComponent(JSON.stringify(pages));
    return Response.redirect(`${returnUrl}?meta_ads_pick_account=true&meta_accounts=${accountsParam}&meta_pages=${pagesParam}`, 302);
  } catch (err) {
    console.error("meta-ads-callback error:", err);
    return Response.redirect("https://nexus.web-business.pt/settings?meta_ads_error=Erro+interno+no+servidor", 302);
  }
});
