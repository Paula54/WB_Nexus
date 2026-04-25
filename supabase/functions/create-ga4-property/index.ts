// Creates a GA4 account + property + web data stream for the user
// using their OAuth token (analytics.edit scope required for full creation,
// but property creation works with the OAuth flow if the user has an existing account).
//
// Strategy: list account summaries; if any account exists, create a Property + Web Data Stream
// under the first account, then save the Measurement ID to projects.google_analytics_id.
// If no account exists, return needsAccount=true so frontend can guide user.

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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get connection
    const { data: conn } = await admin
      .from("google_analytics_connections")
      .select("id, google_refresh_token")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!conn) {
      return new Response(JSON.stringify({ error: "Liga primeiro a tua conta Google." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get project + domain
    const { data: project } = await admin
      .from("projects")
      .select("id, name, domain, website")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const siteRaw = (project?.domain || project?.website || "").trim();
    if (!project || !siteRaw) {
      return new Response(JSON.stringify({ error: "Configura primeiro o domínio do teu site nas Configurações." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const siteUrl = siteRaw.startsWith("http") ? siteRaw : `https://${siteRaw}`;
    const displayName = project.name || siteRaw;

    // Refresh token
    const refreshToken = await decryptToken(conn.google_refresh_token);
    const accessToken = await refreshAccessToken(refreshToken);

    // List GA4 account summaries
    const sumRes = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const sumData = await sumRes.json();
    const summaries = sumData.accountSummaries || [];

    if (summaries.length === 0) {
      // No GA4 account exists — Google requires manual account creation via UI
      return new Response(JSON.stringify({
        needsAccount: true,
        message: "Não tens conta Google Analytics. Cria uma em analytics.google.com (1 minuto) e volta aqui.",
        accountUrl: "https://analytics.google.com/analytics/web/#/provision",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use first account
    const accountName = summaries[0].account; // "accounts/123456"

    // Create property
    const propRes = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/properties",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: accountName,
          displayName,
          timeZone: "Europe/Lisbon",
          currencyCode: "EUR",
          industryCategory: "OTHER",
        }),
      }
    );
    const propData = await propRes.json();
    if (!propRes.ok) {
      console.error("Create property failed:", propData);
      return new Response(JSON.stringify({
        error: propData.error?.message || "Erro ao criar propriedade GA4",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const propertyName = propData.name; // "properties/123"
    const propertyId = propertyName.split("/")[1];

    // Create web data stream
    const streamRes = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/${propertyName}/dataStreams`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "WEB_DATA_STREAM",
          displayName: `${displayName} - Web`,
          webStreamData: { defaultUri: siteUrl },
        }),
      }
    );
    const streamData = await streamRes.json();
    const measurementId = streamData?.webStreamData?.measurementId || null;

    // ============= GTM PROVISIONING =============
    // 1. Find or create a GTM Account
    // 2. Create a Container (web) inside that account
    // 3. Create a workspace + GA4 Configuration tag using the measurementId
    // 4. Create the All Pages trigger and bind it
    // 5. Return public ID (GTM-XXXXXX)
    let gtmContainerPublicId: string | null = null;
    try {
      const gtmHost = "https://tagmanager.googleapis.com/tagmanager/v2";

      // List existing GTM accounts
      const accListRes = await fetch(`${gtmHost}/accounts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const accListData = await accListRes.json();
      let gtmAccountPath: string | null = accListData?.account?.[0]?.path || null;

      // Create one if none exists
      if (!gtmAccountPath) {
        const createAccRes = await fetch(`${gtmHost}/accounts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: displayName, shareData: false }),
        });
        const createAccData = await createAccRes.json();
        gtmAccountPath = createAccData?.path || null;
      }

      if (gtmAccountPath) {
        // Create container (web)
        const domainName = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const containerRes = await fetch(`${gtmHost}/${gtmAccountPath}/containers`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: displayName,
            usageContext: ["web"],
            domainName: [domainName],
          }),
        });
        const containerData = await containerRes.json();
        gtmContainerPublicId = containerData?.publicId || null; // GTM-XXXXXX
        const containerPath = containerData?.path; // accounts/X/containers/Y

        // Provision GA4 Config tag in default workspace (best-effort)
        if (containerPath && measurementId) {
          try {
            const wsRes = await fetch(`${gtmHost}/${containerPath}/workspaces`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const wsData = await wsRes.json();
            const workspacePath = wsData?.workspace?.[0]?.path;

            if (workspacePath) {
              // Create All Pages trigger
              const trigRes = await fetch(`${gtmHost}/${workspacePath}/triggers`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ name: "All Pages", type: "pageview" }),
              });
              const trigData = await trigRes.json();
              const triggerId = trigData?.triggerId;

              // Create GA4 Configuration tag
              await fetch(`${gtmHost}/${workspacePath}/tags`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: "GA4 Configuration",
                  type: "gaawc",
                  parameter: [
                    { type: "template", key: "measurementId", value: measurementId },
                    { type: "boolean", key: "sendPageView", value: "true" },
                  ],
                  firingTriggerId: triggerId ? [triggerId] : [],
                }),
              });
            }
          } catch (tagErr) {
            console.warn("GTM tag provisioning failed:", tagErr);
          }
        }
      }
    } catch (gtmErr) {
      console.warn("GTM provisioning failed (non-fatal):", gtmErr);
    }

    // Save measurement ID + property ID + GTM container
    const projectUpdate: Record<string, string> = {};
    if (measurementId) {
      projectUpdate.google_analytics_id = measurementId;
      projectUpdate.measurement_id = measurementId;
    }
    if (gtmContainerPublicId) {
      projectUpdate.gtm_container_id = gtmContainerPublicId;
    }
    if (Object.keys(projectUpdate).length > 0) {
      await admin.from("projects").update(projectUpdate).eq("id", project.id);
    }
    await admin
      .from("google_analytics_connections")
      .update({ ga4_property_id: propertyId })
      .eq("id", conn.id);

    // Persist refreshed access token
    try {
      await admin
        .from("google_analytics_connections")
        .update({
          google_access_token: await encryptToken(accessToken),
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        })
        .eq("id", conn.id);
    } catch (_e) { /* best effort */ }

    return new Response(JSON.stringify({
      success: true,
      propertyId,
      measurementId,
      gtmContainerId: gtmContainerPublicId,
      message: gtmContainerPublicId
        ? "Google Analytics + GTM criados e configurados com sucesso!"
        : "Google Analytics criado. GTM não foi provisionado (verifica permissões).",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-ga4-property error:", err);
    return new Response(JSON.stringify({ error: "Erro interno. Tenta novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
