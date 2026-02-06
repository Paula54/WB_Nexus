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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub;

    const { campaign_id, project_id, ad_copy, daily_budget, target_audience } = await req.json();

    if (!project_id || !ad_copy) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch Meta credentials from the project using service role
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: project, error: projectError } = await adminClient
      .from("projects")
      .select("meta_ads_account_id, meta_access_token")
      .eq("id", project_id)
      .eq("user_id", userId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ success: false, error: "Projeto não encontrado ou sem permissão" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { meta_ads_account_id, meta_access_token } = project;

    if (!meta_ads_account_id || !meta_access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Meta Ads não está conectado. Conecta a API primeiro.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountId = meta_ads_account_id.startsWith("act_")
      ? meta_ads_account_id
      : `act_${meta_ads_account_id}`;

    // Step 1: Create Campaign
    const campaignResponse = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/campaigns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Nexus Campaign - ${new Date().toISOString().split("T")[0]}`,
          objective: "OUTCOME_TRAFFIC",
          status: "PAUSED",
          special_ad_categories: [],
          access_token: meta_access_token,
        }),
      }
    );

    const campaignResult = await campaignResponse.json();

    if (campaignResult.error) {
      console.error("Meta Campaign Error:", campaignResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Meta API: ${campaignResult.error.message}`,
          meta_error: campaignResult.error,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metaCampaignId = campaignResult.id;

    // Step 2: Create Ad Set
    const adSetResponse = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/adsets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Nexus AdSet - ${target_audience || "Broad"}`,
          campaign_id: metaCampaignId,
          daily_budget: Math.round((daily_budget || 5) * 100), // in cents
          billing_event: "IMPRESSIONS",
          optimization_goal: "LINK_CLICKS",
          bid_strategy: "LOWEST_COST_WITHOUT_CAP",
          targeting: {
            geo_locations: { countries: ["PT"] },
          },
          status: "PAUSED",
          access_token: meta_access_token,
        }),
      }
    );

    const adSetResult = await adSetResponse.json();

    if (adSetResult.error) {
      console.error("Meta AdSet Error:", adSetResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Meta API (AdSet): ${adSetResult.error.message}`,
          meta_campaign_id: metaCampaignId,
          meta_error: adSetResult.error,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Create Ad Creative
    const creativeResponse = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/adcreatives`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Nexus Creative - ${new Date().toISOString().split("T")[0]}`,
          object_story_spec: {
            page_id: "", // This would need to be provided by the user
            link_data: {
              message: ad_copy,
              link: "https://example.com", // User should provide
              call_to_action: {
                type: "LEARN_MORE",
              },
            },
          },
          access_token: meta_access_token,
        }),
      }
    );

    const creativeResult = await creativeResponse.json();

    // Update the local campaign with Meta IDs
    if (campaign_id) {
      await adminClient
        .from("ads_campaigns")
        .update({
          metrics: {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            spend: 0,
            meta_campaign_id: metaCampaignId,
            meta_adset_id: adSetResult.id || null,
            meta_creative_id: creativeResult.id || null,
          },
        })
        .eq("id", campaign_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        meta_campaign_id: metaCampaignId,
        meta_adset_id: adSetResult.id || null,
        meta_creative_id: creativeResult.id || null,
        message: "Campanha criada na Meta Ads com sucesso!",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("publish-ad-campaign error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
