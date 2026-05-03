import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken, isEncrypted } from "../_shared/crypto.ts";

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

    // Only allow calls with service role key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader.replace("Bearer ", "") !== SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results = { google_ads: 0, google_analytics: 0, meta_projects: 0, meta_connections: 0, errors: [] as string[] };

    // 0. Encrypt meta_connections.page_access_token
    const { data: metaConns } = await adminClient
      .from("meta_connections")
      .select("id, page_access_token")
      .eq("is_active", true);

    for (const mc of metaConns || []) {
      if (mc.page_access_token && !isEncrypted(mc.page_access_token)) {
        try {
          const encrypted = await encryptToken(mc.page_access_token);
          await adminClient
            .from("meta_connections")
            .update({ page_access_token: encrypted })
            .eq("id", mc.id);
          results.meta_connections++;
        } catch (e) {
          results.errors.push(`meta_connection ${mc.id}: ${(e as Error).message}`);
        }
      }
    }

    // 1. Encrypt google_ads_accounts.google_refresh_token
    const { data: gadsAccounts } = await adminClient
      .from("google_ads_accounts")
      .select("id, google_refresh_token")
      .eq("is_active", true);

    for (const acc of gadsAccounts || []) {
      if (acc.google_refresh_token && !isEncrypted(acc.google_refresh_token)) {
        try {
          const encrypted = await encryptToken(acc.google_refresh_token);
          await adminClient
            .from("google_ads_accounts")
            .update({ google_refresh_token: encrypted })
            .eq("id", acc.id);
          results.google_ads++;
        } catch (e) {
          results.errors.push(`google_ads ${acc.id}: ${(e as Error).message}`);
        }
      }
    }

    // 2. Encrypt google_analytics_connections tokens
    const { data: gaConns } = await adminClient
      .from("google_analytics_connections")
      .select("id, google_refresh_token, google_access_token")
      .eq("is_active", true);

    for (const conn of gaConns || []) {
      try {
        const updates: Record<string, string> = {};
        if (conn.google_refresh_token && !isEncrypted(conn.google_refresh_token)) {
          updates.google_refresh_token = await encryptToken(conn.google_refresh_token);
        }
        if (conn.google_access_token && !isEncrypted(conn.google_access_token)) {
          updates.google_access_token = await encryptToken(conn.google_access_token);
        }
        if (Object.keys(updates).length > 0) {
          await adminClient
            .from("google_analytics_connections")
            .update(updates)
            .eq("id", conn.id);
          results.google_analytics++;
        }
      } catch (e) {
        results.errors.push(`ga_conn ${conn.id}: ${(e as Error).message}`);
      }
    }

    // 3. Encrypt project_credentials.meta_access_token
    const { data: credentials } = await adminClient
      .from("project_credentials")
      .select("id, meta_access_token");

    for (const cred of credentials || []) {
      if (cred.meta_access_token && !isEncrypted(cred.meta_access_token)) {
        try {
          const encrypted = await encryptToken(cred.meta_access_token);
          await adminClient
            .from("project_credentials")
            .update({ meta_access_token: encrypted })
            .eq("id", cred.id);
          results.meta_projects++;
        } catch (e) {
          results.errors.push(`project_credential ${cred.id}: ${(e as Error).message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Token encryption migration complete",
        encrypted: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("encrypt-existing-tokens error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
