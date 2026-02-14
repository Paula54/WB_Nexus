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

    // Get Meta credentials
    const { data: project } = await adminClient
      .from("projects")
      .select("meta_access_token")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!project?.meta_access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Meta não conectado." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = project.meta_access_token;

    // Get Facebook Page ID and Page Access Token
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();

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

    const page = pagesData.data[0];
    const pageId = page.id;
    const pageAccessToken = page.access_token;

    console.log(`Publishing to Facebook Page: ${page.name} (${pageId})`);

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
      // Photo post
      const photoRes = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/photos`,
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
      // Text-only post
      const feedRes = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/feed`,
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
      console.error("FB Publish error:", publishData.error);
      await adminClient.from("social_posts").update({
        status: "failed",
        error_log: (publishData.error as Record<string, string>).message,
        webhook_response: publishData,
      }).eq("id", postId);

      return new Response(
        JSON.stringify({ success: false, error: (publishData.error as Record<string, string>).message }),
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
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("publish-facebook error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
