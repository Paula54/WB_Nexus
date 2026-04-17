import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Sync forçado GitHub - fallback FACEBOOK_APP_ID/FACEBOOK_APP_SECRET ativo (linhas 79-80)
Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const log = (msg: string, data?: unknown) => console.log(`[${requestId}] ${msg}`, data !== undefined ? JSON.stringify(data) : "");
  const logError = (msg: string, data?: unknown) => console.error(`[${requestId}] ❌ ${msg}`, data !== undefined ? JSON.stringify(data) : "");

  log(`➡️ ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- GET: Webhook verification ---
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode && token && challenge) {
      const VERIFY_TOKEN = Deno.env.get("VERIFY_TOKEN") || Deno.env.get("META_VERIFY_TOKEN") || "nexus2026";
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        log("✅ Webhook verified");
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      return new Response("Forbidden", { status: 403 });
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- POST: Receive user's short-lived token from FB SDK, exchange & store ---
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logError("Missing Authorization header");
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      logError("Auth failed", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    log(`✅ User=${user.id}`);

    const body = await req.json();
    const shortLivedToken = body.access_token;
    const connectionType = body.connection_type || "imported";

    if (!shortLivedToken) {
      logError("No access_token in body");
      return new Response(JSON.stringify({ error: "access_token is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Exchange short-lived for long-lived token ---
    const META_APP_ID = (Deno.env.get("META_APP_ID") || Deno.env.get("FACEBOOK_APP_ID") || Deno.env.get("NEXT_PUBLIC_FB_APP_ID") || Deno.env.get("VITE_FACEBOOK_APP_ID") || "").trim();
    const META_APP_SECRET = (Deno.env.get("META_APP_SECRET") || Deno.env.get("FACEBOOK_APP_SECRET") || "").trim();

    if (!META_APP_ID || !META_APP_SECRET) {
      logError("META_APP_ID or META_APP_SECRET not configured");
      return new Response(JSON.stringify({ error: "Meta app credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("🔄 Exchanging short-lived token for long-lived...");
    const exchangeRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`
    );
    const exchangeData = await exchangeRes.json();

    if (exchangeData.error) {
      logError("Token exchange failed", exchangeData.error);
      return new Response(JSON.stringify({ error: "Token exchange failed", detail: exchangeData.error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const longLivedToken = exchangeData.access_token;
    const expiresIn = exchangeData.expires_in || 5184000;
    log(`✅ Long-lived token obtained, expires in ${expiresIn}s`);

    // --- Fetch Facebook Pages ---
    let facebookPageId: string | null = null;
    let instagramBusinessId: string | null = null;

    try {
      log("📘 Fetching Facebook Pages...");
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${longLivedToken}`
      );
      const pagesData = await pagesRes.json();
      log("📘 Pages", { count: pagesData.data?.length });

      if (pagesData.data?.length > 0) {
        facebookPageId = pagesData.data[0].id;
        if (pagesData.data[0].instagram_business_account?.id) {
          instagramBusinessId = pagesData.data[0].instagram_business_account.id;
        }
      }
    } catch (e) {
      logError("Error fetching pages", e);
    }

    // --- Fetch Ad Account ---
    let adAccountId: string | null = null;
    try {
      const adRes = await fetch(
        `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name&access_token=${longLivedToken}`
      );
      const adData = await adRes.json();
      if (adData.data?.length > 0) {
        adAccountId = adData.data[0].id;
      }
      log("📊 Ad accounts", { count: adData.data?.length, selected: adAccountId });
    } catch (e) {
      logError("Error fetching ad accounts", e);
    }

    // --- Encrypt & Store ---
    const prodUrl = Deno.env.get("PROD_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const prodServiceKey = Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!prodUrl || !prodServiceKey) {
      logError("Production credentials not configured");
      return new Response(JSON.stringify({ error: "Production credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const prodSupabase = createClient(prodUrl, prodServiceKey);

    // Find project
    const { data: project, error: projectError } = await prodSupabase
      .from("projects")
      .select("id, name")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (projectError || !project) {
      logError("Project not found", projectError?.message);
      return new Response(JSON.stringify({ error: projectError?.message || "No project found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    log(`📁 Project: ${project.id}`);

    // Encrypt token
    log("🔒 Encrypting token...");
    const encryptedToken = await encryptToken(longLivedToken);

    // Upsert project_credentials instead of projects
    const credentialsPayload = {
      project_id: project.id,
      user_id: user.id,
      meta_access_token: encryptedToken,
      meta_ads_account_id: adAccountId,
      facebook_page_id: facebookPageId,
      instagram_business_id: instagramBusinessId,
      updated_at: new Date().toISOString(),
    };
    log("💾 Upserting project_credentials...", { project_id: project.id });

    const { error: upsertError } = await prodSupabase
      .from("project_credentials")
      .upsert(credentialsPayload, { onConflict: "project_id" });

    if (upsertError) {
      logError("project_credentials upsert failed", upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Encrypt page access token if we have a page
    let encryptedPageToken: string | null = null;
    if (facebookPageId && longLivedToken) {
      try {
        log("📘 Fetching page access token...");
        const pageTokenRes = await fetch(
          `https://graph.facebook.com/v21.0/${facebookPageId}?fields=access_token&access_token=${longLivedToken}`
        );
        const pageTokenData = await pageTokenRes.json();
        if (pageTokenData.access_token) {
          encryptedPageToken = await encryptToken(pageTokenData.access_token);
          log("✅ Page access token encrypted");
        }
      } catch (e) {
        logError("Error fetching page token", e);
      }
    }

    // Save meta_connection via upsert
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await serviceClient.from("meta_connections").update({ is_active: false }).eq("user_id", user.id).eq("project_id", project.id);
    await serviceClient.from("meta_connections").upsert({
      project_id: project.id,
      user_id: user.id,
      ad_account_id: adAccountId,
      connection_type: connectionType,
      instagram_business_id: instagramBusinessId,
      facebook_page_id: facebookPageId,
      page_access_token: encryptedPageToken,
      is_active: true,
    }, { onConflict: "project_id,user_id" }).select();

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const result = {
      success: true,
      project_id: project.id,
      facebook_page_id: facebookPageId,
      instagram_business_id: instagramBusinessId,
      ad_account_id: adAccountId,
      token_expires_at: expiresAt,
    };
    log("✅ connect-meta completed", result);

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    logError("Unhandled error", { message: err.message, stack: err.stack });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
