import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const META_API_VERSION = "v24.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function logMetaError(stage: string, errObj: Record<string, unknown> | undefined) {
  if (!errObj) return;
  console.error(`[publish-facebook] Meta API error @ ${stage}:`, JSON.stringify({
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

    // Get post
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

    // Get project
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

    // Get LATEST Meta credentials from project_credentials (ordered by updated_at)
    const { data: creds, error: credsError } = await adminClient
      .from("project_credentials")
      .select("meta_access_token, facebook_page_id, updated_at")
      .eq("project_id", project.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (credsError) {
      console.error("[publish-facebook] credentials lookup error:", credsError);
    }
    console.log("[publish-facebook] creds freshness:", {
      project_id: project.id,
      has_token: !!creds?.meta_access_token,
      token_len: creds?.meta_access_token ? String(creds.meta_access_token).length : 0,
      stored_page_id: creds?.facebook_page_id ?? null,
      updated_at: creds?.updated_at ?? null,
    });

    if (!creds?.meta_access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Meta não conectado." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = String(creds.meta_access_token);

    // Get Facebook Page ID + page-scoped access token (always fetch fresh)
    const pagesRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(accessToken)}`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      logMetaError("me/accounts", pagesData.error);
      await adminClient.from("social_posts").update({
        status: "failed",
        error_log: pagesData.error.error_user_msg || pagesData.error.message || "Erro ao obter páginas Facebook",
        webhook_response: pagesData,
      }).eq("id", postId);

      return new Response(
        JSON.stringify({ success: false, error: pagesData.error.error_user_msg || pagesData.error.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pagesData.data || pagesData.data.length === 0) {
      await adminClient.from("social_posts").update({
        status: "failed",
        error_log: "Nenhuma página Facebook encontrada.",
      }).eq("id", postId);

      return new Response(
        JSON.stringify({ success: false, error: "Nenhuma página Facebook encontrada." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prefer the page stored in credentials, fall back to first available
    const storedPageId = creds.facebook_page_id ? String(creds.facebook_page_id) : null;
    const matchedPage = storedPageId
      ? pagesData.data.find((p: { id: string }) => String(p.id) === storedPageId)
      : null;
    const page = matchedPage ?? pagesData.data[0];
    const pageId = String(page.id); // ensure string for URL
    const pageAccessToken = String(page.access_token);

    console.log(`[publish-facebook] Publishing to Page: ${page.name} (${pageId}) using ${META_API_VERSION}`);

    // Build message with hashtags
    let message = post.caption || "";
    if (post.hashtags && post.hashtags.length > 0) {
      const hashtagStr = post.hashtags
        .map((t: string) => (t.startsWith("#") ? t : `#${t}`))
        .join(" ");
      message = `${message}\n\n${hashtagStr}`;
    }

    let publishData: Record<string, unknown>;

    if (post.image_url) {
      const photoRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${pageId}/photos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: post.image_url,
            message,
            access_token: pageAccessToken,
          }),
        }
      );
      publishData = await photoRes.json();
    } else {
      const feedRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${pageId}/feed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            access_token: pageAccessToken,
          }),
        }
      );
      publishData = await feedRes.json();
    }

    if (publishData.error) {
      const err = publishData.error as Record<string, unknown>;
      logMetaError("publish", err);
      const userMsg = (err.error_user_msg as string) || (err.message as string) || "Erro Meta desconhecido";

      await adminClient.from("social_posts").update({
        status: "failed",
        error_log: userMsg,
        webhook_response: publishData,
      }).eq("id", postId);

      return new Response(
        JSON.stringify({
          success: false,
          error: userMsg,
          meta_error: {
            code: err.code,
            type: err.type,
            error_subcode: err.error_subcode,
            error_user_title: err.error_user_title,
            error_user_msg: err.error_user_msg,
            fbtrace_id: err.fbtrace_id,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success
    await adminClient.from("social_posts").update({
      status: "published",
      published_at: new Date().toISOString(),
      webhook_response: publishData,
      error_log: null,
    }).eq("id", postId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Post publicado no Facebook!",
        fb_post_id: publishData.id || publishData.post_id,
        api_version: META_API_VERSION,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[publish-facebook] internal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
