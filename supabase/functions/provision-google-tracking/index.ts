import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- JWT signing for Service Account ---

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function createServiceAccountToken(scopes: string[]): Promise<string> {
  const saJson = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: saJson.client_email,
    scope: scopes.join(" "),
    aud: saJson.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import PEM private key
  const pemBody = saJson.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");
  const keyBuf = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBuf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(signingInput)
  );

  const jwt = `${signingInput}.${base64url(sig)}`;

  // Exchange JWT for access token
  const tokenRes = await fetch(saJson.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    throw new Error(`SA token error: ${tokenData.error_description || tokenData.error}`);
  }
  return tokenData.access_token;
}

// --- Google API helpers ---

async function createGA4Property(
  accessToken: string,
  displayName: string,
  timeZone = "Europe/Lisbon"
): Promise<{ propertyId: string }> {
  // First, get or find the GA account
  const accountsRes = await fetch(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const accountsData = await accountsRes.json();
  console.log("Account summaries:", JSON.stringify(accountsData));

  const accounts = accountsData.accountSummaries || [];
  if (accounts.length === 0) {
    throw new Error("Nenhuma conta Google Analytics encontrada. Cria uma em analytics.google.com primeiro.");
  }

  const accountId = accounts[0].account; // e.g. "accounts/123456"

  // Create GA4 property
  const propRes = await fetch(
    "https://analyticsadmin.googleapis.com/v1beta/properties",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: accountId,
        displayName,
        timeZone,
        industryCategory: "BUSINESS_AND_INDUSTRIAL_MARKETS",
      }),
    }
  );

  const propData = await propRes.json();
  console.log("Created property:", JSON.stringify(propData));

  if (propData.error) {
    throw new Error(`GA4 property error: ${propData.error.message}`);
  }

  // Extract property ID (format: "properties/123456")
  const propertyId = propData.name?.replace("properties/", "") || "";
  return { propertyId };
}

async function createWebStream(
  accessToken: string,
  propertyId: string,
  websiteUrl: string,
  displayName: string
): Promise<{ measurementId: string }> {
  const res = await fetch(
    `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/dataStreams`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "WEB_DATA_STREAM",
        displayName,
        webStreamData: {
          defaultUri: websiteUrl,
        },
      }),
    }
  );

  const data = await res.json();
  console.log("Created web stream:", JSON.stringify(data));

  if (data.error) {
    throw new Error(`Web stream error: ${data.error.message}`);
  }

  return { measurementId: data.webStreamData?.measurementId || "" };
}

async function createGTMContainer(
  accessToken: string,
  displayName: string,
  websiteUrl: string
): Promise<{ containerId: string; publicId: string }> {
  // List GTM accounts
  const accountsRes = await fetch(
    "https://tagmanager.googleapis.com/tagmanager/v2/accounts",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const accountsData = await accountsRes.json();
  console.log("GTM accounts:", JSON.stringify(accountsData));

  const gtmAccounts = accountsData.account || [];
  if (gtmAccounts.length === 0) {
    throw new Error("Nenhuma conta GTM encontrada. Cria uma em tagmanager.google.com primeiro.");
  }

  const gtmAccountPath = gtmAccounts[0].path; // e.g. "accounts/123456"

  // Create container
  const containerRes = await fetch(
    `https://tagmanager.googleapis.com/tagmanager/v2/${gtmAccountPath}/containers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: displayName,
        usageContext: ["web"],
        domainName: [websiteUrl.replace(/^https?:\/\//, "")],
      }),
    }
  );

  const containerData = await containerRes.json();
  console.log("Created GTM container:", JSON.stringify(containerData));

  if (containerData.error) {
    throw new Error(`GTM container error: ${containerData.error.message}`);
  }

  return {
    containerId: containerData.containerId || "",
    publicId: containerData.publicId || "", // e.g. GTM-XXXXXX
  };
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user
    const supabaseClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { projectId, siteName, websiteUrl } = await req.json();

    if (!projectId || !siteName || !websiteUrl) {
      return new Response(
        JSON.stringify({ error: "projectId, siteName e websiteUrl são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get service account access token with all needed scopes
    const accessToken = await createServiceAccountToken([
      "https://www.googleapis.com/auth/analytics.edit",
      "https://www.googleapis.com/auth/tagmanager.edit.containers",
    ]);

    // 1. Create GA4 Property
    const { propertyId } = await createGA4Property(accessToken, siteName);

    // 2. Create Web Stream → get measurementId (G-XXXXXX)
    const { measurementId } = await createWebStream(
      accessToken,
      propertyId,
      websiteUrl,
      `${siteName} - Web`
    );

    // 3. Create GTM Container → get GTM-XXXXXX
    let gtmContainerId = "";
    try {
      const gtmResult = await createGTMContainer(accessToken, siteName, websiteUrl);
      gtmContainerId = gtmResult.publicId;
    } catch (gtmErr) {
      console.warn("GTM creation failed (non-fatal):", gtmErr);
      // GTM is optional – continue without it
    }

    // 4. Save to database
    const adminClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    await adminClient
      .from("projects")
      .update({
        google_analytics_id: measurementId,
        measurement_id: measurementId,
        gtm_container_id: gtmContainerId || null,
      })
      .eq("id", projectId)
      .eq("user_id", userId);

    // Also store the GA4 property ID in connections for data fetching
    const { data: existingConn } = await adminClient
      .from("google_analytics_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (existingConn) {
      await adminClient
        .from("google_analytics_connections")
        .update({ ga4_property_id: propertyId })
        .eq("id", existingConn.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        measurementId,
        gtmContainerId: gtmContainerId || null,
        propertyId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("provision-google-tracking error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
