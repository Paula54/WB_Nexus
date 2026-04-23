import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const META_API_VERSION = "v24.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function logMetaError(stage: string, errObj: Record<string, unknown> | undefined) {
  if (!errObj) return;
  console.error(`[publish-instagram] Meta API error @ ${stage}:`, JSON.stringify({
    message: errObj.message,
    type: errObj.type,
    code: errObj.code,
    error_subcode: errObj.error_subcode,
    error_user_title: errObj.error_user_title,
    error_user_msg: errObj.error_user_msg,
    fbtrace_id: errObj.fbtrace_id,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const { postId } = await req.json();
    if (!postId) {
      return new Response(
        JSON.stringify({ success: false, error: "Post ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: post, error: postError } = await adminClient
      .from("social_posts")
      .select("*")
      .eq("id", postId)
      .eq("user_id", user.id)
      .single();

    if (postError || !post) {
      return new Response(
        JSON.stringify({ success: false, error: "Post not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: project } = await adminClient
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!project) {
      return new Response(
        JSON.stringify({ success: false, error: "Projeto não encontrado." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LATEST credentials
    const { data: creds } = await adminClient
      .from("project_credentials")
      .select("meta_access_token, instagram_business_id, updated_at")
      .eq("project_id", project.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log("[publish-instagram] creds freshness:", {
      project_id: project.id,
      has_token: !!creds?.meta_access_token,
      token_len: creds?.meta_access_token ? String(creds.meta_access_token).length : 0,
      stored_ig_id: creds?.instagram_business_id ?? null,
      updated_at: creds?.updated_at ?? null,
    });

    if (!creds?.meta_access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Meta não conectado. Troca o token primeiro." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = String(creds.meta_access_token);

    // Resolve IG business account: prefer stored, fall back to discovery
    let igAccountId: string | null = creds.instagram_business_id ? String(creds.instagram_business_id) : null;

    if (!igAccountId) {
      const pagesRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/me/accounts?fields=instagram_business_account{id}&access_token=${encodeURIComponent(accessToken)}`
      );
      const pagesData = await pagesRes.json();

      if (pagesData.error) {
        logMetaError("me/accounts", pagesData.error);
      }

      for (const page of pagesData.data || []) {
        if (page.instagram_business_account) {
          igAccountId = String(page.instagram_business_account.id);
          break;
        }
      }
    }

    if (!igAccountId) {
      await adminClient.from("social_posts").update({
        status: "failed",
        error_log: "Instagram Business Account não encontrada. Verifica que a Page está ligada ao IG.",
      }).eq("id", postId);

      return new Response(
        JSON.stringify({ success: false, error: "Instagram Business Account não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let caption = post.caption || "";
    if (post.hashtags && post.hashtags.length > 0) {
      const hashtagStr = post.hashtags
        .map((t: string) => (t.startsWith("#") ? t : `#${t}`))
        .join(" ");
      caption = `${caption}\n\n${hashtagStr}`;
    }

    const containerBody: Record<string, string> = {
      caption,
      access_token: accessToken,
    };

    if (post.image_url) {
      containerBody.image_url = post.image_url;
    } else {
      await adminClient.from("social_posts").update({
        status: "failed",
        error_log: "Instagram requer uma imagem. Adiciona uma imagem ao post.",
      }).eq("id", postId);

      return new Response(
        JSON.stringify({ success: false, error: "Instagram requer uma imagem" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (post.scheduled_at) {
      const scheduledTimestamp = Math.floor(new Date(post.scheduled_at).getTime() / 1000);
      const now = Math.floor(Date.now() / 1000);
      const tenMinutes = 10 * 60;
      const seventyFiveDays = 75 * 24 * 60 * 60;

      if (scheduledTimestamp > now + tenMinutes && scheduledTimestamp < now + seventyFiveDays) {
        containerBody.published = "false";
      }
    }

    console.log(`[publish-instagram] Creating container @ ${META_API_VERSION} for IG ${igAccountId}`);

    const containerRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${igAccountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(containerBody),
      }
    );
    const containerData = await containerRes.json();

    if (containerData.error) {
      logMetaError("create-container", containerData.error);
      const userMsg = containerData.error.error_user_msg || containerData.error.message;

      await adminClient.from("social_posts").update({
        status: "failed",
        error_log: userMsg,
        webhook_response: containerData,
      }).eq("id", postId);

      return new Response(
        JSON.stringify({ success: false, error: userMsg, meta_error: containerData.error }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creationId = String(containerData.id);

    const maxAttempts = 15;
    for (let i = 0; i < maxAttempts; i++) {
      const statusRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${creationId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
      );
      const statusData = await statusRes.json();
      console.log(`[publish-instagram] Container status (${i + 1}):`, statusData.status_code);

      if (statusData.status_code === "FINISHED") break;
      if (statusData.status_code === "ERROR") {
        await adminClient.from("social_posts").update({
          status: "failed",
          error_log: `Container processing failed: ${JSON.stringify(statusData)}`,
          webhook_response: statusData,
        }).eq("id", postId);

        return new Response(
          JSON.stringify({ success: false, error: "Instagram media processing failed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const publishRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${igAccountId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: accessToken,
        }),
      }
    );
    const publishData = await publishRes.json();

    if (publishData.error) {
      logMetaError("media_publish", publishData.error);
      const userMsg = publishData.error.error_user_msg || publishData.error.message;

      await adminClient.from("social_posts").update({
        status: "failed",
        error_log: userMsg,
        webhook_response: publishData,
      }).eq("id", postId);

      return new Response(
        JSON.stringify({ success: false, error: userMsg, meta_error: publishData.error }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isScheduled = Boolean(post.scheduled_at);
    await adminClient.from("social_posts").update({
      status: isScheduled ? "scheduled" : "published",
      published_at: isScheduled ? null : new Date().toISOString(),
      webhook_response: publishData,
      error_log: null,
    }).eq("id", postId);

    return new Response(
      JSON.stringify({
        success: true,
        message: isScheduled ? "Post agendado no Instagram!" : "Post publicado no Instagram!",
        ig_media_id: publishData.id,
        api_version: META_API_VERSION,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[publish-instagram] internal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
