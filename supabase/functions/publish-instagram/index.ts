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

    // Get Meta credentials from project
    const { data: project } = await adminClient
      .from("projects")
      .select("meta_access_token")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!project?.meta_access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Meta não conectado. Troca o token primeiro." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = project.meta_access_token;

    // Get Instagram Business Account ID via pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account{id}&access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();

    let igAccountId: string | null = null;
    for (const page of pagesData.data || []) {
      if (page.instagram_business_account) {
        igAccountId = page.instagram_business_account.id;
        break;
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

    // Build caption with hashtags
    let caption = post.caption || "";
    if (post.hashtags && post.hashtags.length > 0) {
      const hashtagStr = post.hashtags
        .map((t: string) => (t.startsWith("#") ? t : `#${t}`))
        .join(" ");
      caption = `${caption}\n\n${hashtagStr}`;
    }

    // Step 1: Create media container
    const containerBody: Record<string, string> = {
      caption,
      access_token: accessToken,
    };

    if (post.image_url) {
      containerBody.image_url = post.image_url;
    } else {
      // Instagram requires media - if no image, fail gracefully
      await adminClient.from("social_posts").update({
        status: "failed",
        error_log: "Instagram requer uma imagem. Adiciona uma imagem ao post.",
      }).eq("id", postId);

      return new Response(
        JSON.stringify({ success: false, error: "Instagram requer uma imagem" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle scheduling
    if (post.scheduled_at) {
      const scheduledTimestamp = Math.floor(new Date(post.scheduled_at).getTime() / 1000);
      const now = Math.floor(Date.now() / 1000);
      const tenMinutes = 10 * 60;
      const seventyFiveDays = 75 * 24 * 60 * 60;

      if (scheduledTimestamp > now + tenMinutes && scheduledTimestamp < now + seventyFiveDays) {
        containerBody.published = "false";
      }
    }

    const containerRes = await fetch(
      `https://graph.facebook.com/v21.0/${igAccountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(containerBody),
      }
    );
    const containerData = await containerRes.json();

    if (containerData.error) {
      console.error("IG Container error:", containerData.error);
      await adminClient.from("social_posts").update({
        status: "failed",
        error_log: containerData.error.message,
        webhook_response: containerData,
      }).eq("id", postId);

      return new Response(
        JSON.stringify({ success: false, error: containerData.error.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creationId = containerData.id;

    // Step 2: Publish the container
    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${igAccountId}/media_publish`,
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
      console.error("IG Publish error:", publishData.error);
      await adminClient.from("social_posts").update({
        status: "failed",
        error_log: publishData.error.message,
        webhook_response: publishData,
      }).eq("id", postId);

      return new Response(
        JSON.stringify({ success: false, error: publishData.error.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success
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
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("publish-instagram error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
