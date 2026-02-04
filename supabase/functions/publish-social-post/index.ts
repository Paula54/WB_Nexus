import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AYRSHARE_API_URL = "https://app.ayrshare.com/api/post";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AYRSHARE_API_KEY = Deno.env.get("AYRSHARE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!AYRSHARE_API_KEY) {
      throw new Error("AYRSHARE_API_KEY is not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const { postId } = await req.json();

    if (!postId) {
      return new Response(
        JSON.stringify({ error: "Post ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the post from the database
    const { data: post, error: fetchError } = await supabase
      .from("social_posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (fetchError || !post) {
      console.error("Error fetching post:", fetchError);
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map platform names to Ayrshare format
    const platformMap: Record<string, string> = {
      instagram: "instagram",
      facebook: "facebook",
      linkedin: "linkedin",
      twitter: "twitter",
      tiktok: "tiktok",
    };

    const ayrshaPlatform = platformMap[post.platform.toLowerCase()] || post.platform.toLowerCase();

    // Build the Ayrshare payload
    const ayrsharePayload: Record<string, unknown> = {
      post: post.caption,
      platforms: [ayrshaPlatform],
    };

    // Add media if available
    if (post.image_url) {
      ayrsharePayload.mediaUrls = [post.image_url];
    }

    // Add hashtags if available (for platforms that support them)
    if (post.hashtags && post.hashtags.length > 0) {
      // Hashtags are typically included in the post text
      const hashtagString = post.hashtags.map((tag: string) => 
        tag.startsWith("#") ? tag : `#${tag}`
      ).join(" ");
      ayrsharePayload.post = `${post.caption}\n\n${hashtagString}`;
    }

    // Add scheduling if scheduled_at is set
    if (post.scheduled_at) {
      const scheduledDate = new Date(post.scheduled_at);
      // Ayrshare expects ISO 8601 format
      ayrsharePayload.scheduleDate = scheduledDate.toISOString();
    }

    console.log("Publishing to Ayrshare:", JSON.stringify(ayrsharePayload));

    // Call Ayrshare API
    const ayrshareResponse = await fetch(AYRSHARE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
      },
      body: JSON.stringify(ayrsharePayload),
    });

    const ayrshareData = await ayrshareResponse.json();
    console.log("Ayrshare response:", JSON.stringify(ayrshareData));

    // Check for errors: either HTTP error OR Ayrshare's status field indicates error
    const hasError = !ayrshareResponse.ok || ayrshareData.status === "error";

    if (hasError) {
      // Update post with error status
      await supabase
        .from("social_posts")
        .update({
          status: "failed",
          error_log: JSON.stringify(ayrshareData),
          webhook_response: ayrshareData,
        })
        .eq("id", postId);

      // Return 200 with error payload so frontend can handle it gracefully
      return new Response(
        JSON.stringify({ 
          error: "Failed to publish", 
          details: ayrshareData 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine the status based on whether it was scheduled or published immediately
    const isScheduled = Boolean(post.scheduled_at);
    const newStatus = isScheduled ? "scheduled" : "published";
    
    // Update post with success status
    const { error: updateError } = await supabase
      .from("social_posts")
      .update({
        status: newStatus,
        published_at: isScheduled ? null : new Date().toISOString(),
        webhook_response: ayrshareData,
        error_log: null,
      })
      .eq("id", postId);

    if (updateError) {
      console.error("Error updating post status:", updateError);
    }

    const successMessage = isScheduled 
      ? "Post agendado com sucesso!"
      : "Post publicado com sucesso!";

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: successMessage,
        scheduled: isScheduled,
        ayrshare_response: ayrshareData 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Publish error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
