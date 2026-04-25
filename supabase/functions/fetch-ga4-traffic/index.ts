// Fetches GA4 traffic data (sessions, users, pageviews) for the user's connected property
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken, encryptToken } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: (Deno.env.get("GOOGLE_ADS_CLIENT_ID") || "").trim(),
      client_secret: (Deno.env.get("GOOGLE_ADS_CLIENT_SECRET") || "").trim(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Falha ao renovar access token");
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: conn } = await admin
      .from("google_analytics_connections")
      .select("id, google_refresh_token, ga4_property_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!conn) {
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If no GA4 property linked yet, try to auto-detect from account summaries
    let propertyId = conn.ga4_property_id;
    const refreshToken = await decryptToken(conn.google_refresh_token);
    const accessToken = await refreshAccessToken(refreshToken);

    if (!propertyId) {
      const sumRes = await fetch(
        "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const sumData = await sumRes.json();
      const summaries = sumData.accountSummaries || [];
      for (const acc of summaries) {
        if (acc.propertySummaries?.length) {
          propertyId = acc.propertySummaries[0].property.split("/")[1];
          break;
        }
      }
      if (propertyId) {
        await admin
          .from("google_analytics_connections")
          .update({ ga4_property_id: propertyId })
          .eq("id", conn.id);
      }
    }

    // Persist refreshed token
    try {
      await admin
        .from("google_analytics_connections")
        .update({
          google_access_token: await encryptToken(accessToken),
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        })
        .eq("id", conn.id);
    } catch (_e) { /* best effort */ }

    if (!propertyId) {
      return new Response(JSON.stringify({ connected: true, hasProperty: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run GA4 report (last 28 days)
    const reportRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "screenPageViews" },
            { name: "engagementRate" },
          ],
        }),
      }
    );
    const reportData = await reportRes.json();

    if (reportData.error) {
      return new Response(JSON.stringify({
        connected: true, hasProperty: true, error: reportData.error.message,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const row = reportData.rows?.[0]?.metricValues || [];
    const totals = {
      sessions: parseInt(row[0]?.value || "0", 10),
      users: parseInt(row[1]?.value || "0", 10),
      pageviews: parseInt(row[2]?.value || "0", 10),
      engagementRate: parseFloat(row[3]?.value || "0"),
    };

    return new Response(JSON.stringify({
      connected: true,
      hasProperty: true,
      propertyId,
      totals,
      hasData: totals.sessions > 0 || totals.users > 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("fetch-ga4-traffic error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
