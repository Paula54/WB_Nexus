// TEMPORARY diagnostic function — inspects production schema integrity.
// Safe: read-only against information_schema; no data writes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROD_URL = Deno.env.get("PROD_SUPABASE_URL") || "https://hqyuxponbobmuletqshq.supabase.co";
const PROD_KEY = Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(PROD_URL, PROD_KEY);
  const report: Record<string, unknown> = { prod_url: PROD_URL };

  // Tables we care about
  const targets = [
    "meta_connections",
    "project_credentials",
    "projects",
    "profiles",
    "subscriptions",
  ];

  // Use a postgres function via REST: query information_schema through a SELECT
  // We can use the PostgREST endpoint by selecting from information_schema views via .rpc not available;
  // workaround: do a HEAD with select=column on each candidate column to detect existence.

  const expectedColumns: Record<string, string[]> = {
    meta_connections: [
      "id", "user_id", "project_id", "ad_account_id", "facebook_page_id",
      "instagram_business_id", "page_access_token", "connection_type",
      "is_active", "created_at", "updated_at", "whatsapp_account_id",
    ],
    project_credentials: [
      "id", "user_id", "project_id", "meta_access_token", "meta_ads_account_id",
      "facebook_page_id", "instagram_business_id", "whatsapp_business_id",
      "whatsapp_phone_number_id", "created_at", "updated_at",
    ],
    projects: [
      "id", "user_id", "name", "meta_access_token", "meta_ads_account_id",
      "facebook_page_id", "instagram_business_id",
    ],
  };

  const tableReports: Record<string, unknown> = {};

  for (const table of targets) {
    const cols = expectedColumns[table] ?? ["id"];
    const colReport: Record<string, string> = {};

    for (const col of cols) {
      const url = `${PROD_URL}/rest/v1/${table}?select=${col}&limit=0`;
      try {
        const r = await fetch(url, {
          headers: { apikey: PROD_KEY, Authorization: `Bearer ${PROD_KEY}` },
        });
        if (r.ok) {
          colReport[col] = "OK";
        } else {
          const t = await r.text();
          colReport[col] = `MISSING (${r.status}): ${t.slice(0, 160)}`;
        }
      } catch (e) {
        colReport[col] = `ERR: ${(e as Error).message}`;
      }
    }
    tableReports[table] = colReport;
  }

  report.tables = tableReports;

  // Sample row counts (sanity)
  const counts: Record<string, unknown> = {};
  for (const table of ["meta_connections", "project_credentials", "projects"]) {
    try {
      const r = await fetch(`${PROD_URL}/rest/v1/${table}?select=id`, {
        headers: {
          apikey: PROD_KEY,
          Authorization: `Bearer ${PROD_KEY}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
      });
      counts[table] = r.headers.get("content-range") || `status=${r.status}`;
    } catch (e) {
      counts[table] = `ERR: ${(e as Error).message}`;
    }
  }
  report.row_counts = counts;

  return new Response(JSON.stringify(report, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
