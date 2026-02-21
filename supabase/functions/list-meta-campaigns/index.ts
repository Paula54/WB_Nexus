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

    // Get project credentials
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: project, error: projectError } = await adminClient
      .from("projects")
      .select("meta_ads_account_id, meta_access_token")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (projectError || !project?.meta_ads_account_id || !project?.meta_access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Meta Ads não conectado", campaigns: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { meta_ads_account_id, meta_access_token } = project;

    // Fetch campaigns from Meta Marketing API
    const campaignsUrl = `https://graph.facebook.com/v21.0/${meta_ads_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,insights.date_preset(last_30d){impressions,clicks,spend,ctr,cpc,actions}&access_token=${meta_access_token}`;

    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();

    if (campaignsData.error) {
      console.error("Meta API error:", campaignsData.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: campaignsData.error.message,
          campaigns: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const campaigns = (campaignsData.data || []).map((c: any) => {
      const insights = c.insights?.data?.[0] || {};
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
        impressions: Number(insights.impressions || 0),
        clicks: Number(insights.clicks || 0),
        spend: Number(insights.spend || 0),
        ctr: Number(insights.ctr || 0),
        cpc: Number(insights.cpc || 0),
      };
    });

    return new Response(
      JSON.stringify({ success: true, campaigns }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("list-meta-campaigns error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message, campaigns: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
