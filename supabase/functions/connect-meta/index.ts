import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const log = (msg: string, data?: unknown) => console.log(`[${requestId}] ${msg}`, data !== undefined ? JSON.stringify(data) : "");
  const logError = (msg: string, data?: unknown) => console.error(`[${requestId}] ❌ ${msg}`, data !== undefined ? JSON.stringify(data) : "");

  log(`➡️ ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- GET: Webhook verification OR Facebook Login redirect ---
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // 1) Meta Webhook Verification
    if (mode && token && challenge) {
      const VERIFY_TOKEN = Deno.env.get("VERIFY_TOKEN") || Deno.env.get("META_VERIFY_TOKEN") || "nexus2026";
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ Webhook verified successfully");
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      console.error("❌ Webhook verification failed", { mode, token });
      return new Response("Forbidden", { status: 403, headers: { "Content-Type": "text/plain" } });
    }

    // 2) Facebook Login — generate OAuth URL
    const META_APP_ID = "1578338553386945";
    const redirectUri = "https://nexus.web-business.pt/auth/callback";
    const scopes = "pages_show_list,pages_read_engagement,instagram_basic,ads_management,business_management";
    const returnOrigin = url.searchParams.get("return_origin") || "https://nexus.web-business.pt";

    const loginUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(returnOrigin)}&response_type=code`;

    return new Response(JSON.stringify({ login_url: loginUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
    log("🔑 Auth: validating user token...");
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      logError("Auth failed", { error: authError?.message });
      return new Response(JSON.stringify({ error: "Unauthorized", detail: authError?.message }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log(`✅ Auth OK — user=${user.id}, email=${user.email}`);

    // Production client — use standard Supabase env vars
    const prodUrl = Deno.env.get("PROD_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const prodServiceKey = Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    log("🏭 Prod env check", { hasProdUrl: !!prodUrl, hasProdKey: !!prodServiceKey, usingFallback: !Deno.env.get("PROD_SUPABASE_URL") });
    if (!prodUrl || !prodServiceKey) {
      logError("Production credentials not configured");
      return new Response(JSON.stringify({ error: "Production credentials not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const prodSupabase = createClient(prodUrl, prodServiceKey);

    const body = await req.json();
    const connection_type = body.connection_type;
    log("📦 Request body", { connection_type });

    const metaAccessToken = Deno.env.get("META_ACCESS_TOKEN");
    const adAccountId = Deno.env.get("META_AD_ACCOUNT_ID");
    log("🔧 Meta env", { hasToken: !!metaAccessToken, tokenLength: metaAccessToken?.length, adAccountId });

    if (!metaAccessToken) {
      logError("META_ACCESS_TOKEN not configured");
      return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token
    log("🌐 Validating Meta token with Graph API...");
    const tokenCheck = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${metaAccessToken}`);
    const tokenBody = await tokenCheck.json();
    log("🌐 Meta token validation result", { status: tokenCheck.status, ok: tokenCheck.ok, name: tokenBody.name, id: tokenBody.id, error: tokenBody.error });
    if (!tokenCheck.ok) {
      logError("Meta token invalid or expired", tokenBody.error);
      return new Response(JSON.stringify({ error: "Meta token invalid or expired", detail: tokenBody.error?.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Legal consent check skipped — handled at app level

    // Find project
    const { data: project, error: projectError } = await prodSupabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: projectError?.message || "No project found" }), {
        status: projectError ? 500 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Fetch Facebook Page, Instagram Business, WhatsApp Business IDs ---
    let facebookPageId: string | null = null;
    let instagramBusinessId: string | null = null;
    let whatsappBusinessId: string | null = null;

    // Facebook Pages
    try {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name&access_token=${metaAccessToken}`
      );
      const pagesData = await pagesRes.json();
      if (pagesData.data?.length > 0) {
        facebookPageId = pagesData.data[0].id;
        console.log(`Facebook Page: ${facebookPageId}`);

        // Instagram Business Account linked to the page
        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${facebookPageId}?fields=instagram_business_account&access_token=${metaAccessToken}`
        );
        const igData = await igRes.json();
        if (igData.instagram_business_account?.id) {
          instagramBusinessId = igData.instagram_business_account.id;
          console.log(`Instagram Business: ${instagramBusinessId}`);
        }
      }
    } catch (e) {
      console.error("Error fetching pages/instagram:", e);
    }

    // WhatsApp Business Account
    const whatsappEnvId = Deno.env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID");
    if (whatsappEnvId) {
      whatsappBusinessId = whatsappEnvId;
      console.log(`WhatsApp Business: ${whatsappBusinessId}`);
    }

    // Encrypt token
    const encryptedToken = await encryptToken(metaAccessToken);

    // Update production project with all IDs
    const updatePayload: Record<string, unknown> = {
      meta_access_token: encryptedToken,
      meta_ads_account_id: adAccountId || null,
      facebook_page_id: facebookPageId,
      instagram_business_id: instagramBusinessId,
      whatsapp_business_id: whatsappBusinessId,
    };

    const { error: updateError } = await prodSupabase
      .from("projects")
      .update(updatePayload)
      .eq("id", project.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert meta_connection in Lovable Cloud
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.from("meta_connections").update({ is_active: false }).eq("user_id", user.id).eq("project_id", project.id);
    await supabase.from("meta_connections").insert({
      project_id: project.id,
      user_id: user.id,
      ad_account_id: adAccountId || null,
      connection_type: connection_type || "imported",
      whatsapp_account_id: whatsappBusinessId,
      instagram_business_id: instagramBusinessId,
      is_active: true,
    });

    console.log(`✅ Meta connected: project=${project.id}, fb=${facebookPageId}, ig=${instagramBusinessId}, wa=${whatsappBusinessId}`);

    return new Response(JSON.stringify({
      success: true,
      project_id: project.id,
      facebook_page_id: facebookPageId,
      instagram_business_id: instagramBusinessId,
      whatsapp_business_id: whatsappBusinessId,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("connect-meta error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
