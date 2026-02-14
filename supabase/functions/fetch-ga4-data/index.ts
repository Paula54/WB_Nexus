import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = (Deno.env.get("GOOGLE_ADS_CLIENT_ID") || "").trim();
  const clientSecret = (Deno.env.get("GOOGLE_ADS_CLIENT_SECRET") || "").trim();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: conn } = await adminClient
      .from("google_analytics_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!conn) {
      return new Response(JSON.stringify({ error: "Google Analytics não conectado", connected: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { propertyId, startDate, endDate } = await req.json();

    const accessToken = await refreshAccessToken(conn.google_refresh_token);

    // Update stored access token
    await adminClient
      .from("google_analytics_connections")
      .update({ google_access_token: accessToken, token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString() })
      .eq("id", conn.id);

    const targetProperty = propertyId || conn.ga4_property_id;

    // If no property, list available properties
    if (!targetProperty) {
      const accountsRes = await fetch(
        "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const accountsData = await accountsRes.json();

      const properties: any[] = [];
      for (const account of accountsData.accountSummaries || []) {
        for (const prop of account.propertySummaries || []) {
          properties.push({
            propertyId: prop.property?.replace("properties/", ""),
            displayName: prop.displayName,
            propertyType: prop.propertyType,
          });
        }
      }

      return new Response(JSON.stringify({ needsPropertyId: true, properties }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch GA4 data
    const end = endDate || new Date().toISOString().split("T")[0];
    const start = startDate || new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const gaRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${targetProperty}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: start, endDate: end }],
          dimensions: [{ name: "date" }],
          metrics: [
            { name: "sessions" },
            { name: "activeUsers" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
          ],
          orderBys: [{ dimension: { dimensionName: "date" } }],
        }),
      }
    );

    const gaData = await gaRes.json();

    if (gaData.error) {
      return new Response(JSON.stringify({ error: gaData.error.message }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = gaData.rows || [];
    const daily = rows.map((r: any) => ({
      date: r.dimensionValues?.[0]?.value || "",
      sessions: parseInt(r.metricValues?.[0]?.value || "0"),
      activeUsers: parseInt(r.metricValues?.[1]?.value || "0"),
      pageViews: parseInt(r.metricValues?.[2]?.value || "0"),
      bounceRate: parseFloat(r.metricValues?.[3]?.value || "0"),
    }));

    const totals = daily.reduce(
      (acc: any, d: any) => ({
        sessions: acc.sessions + d.sessions,
        activeUsers: acc.activeUsers + d.activeUsers,
        pageViews: acc.pageViews + d.pageViews,
        bounceRate: 0,
      }),
      { sessions: 0, activeUsers: 0, pageViews: 0, bounceRate: 0 }
    );

    if (daily.length > 0) {
      totals.bounceRate = daily.reduce((s: number, d: any) => s + d.bounceRate, 0) / daily.length;
    }

    return new Response(JSON.stringify({
      totals,
      daily,
      propertyId: targetProperty,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("fetch-ga4-data error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
