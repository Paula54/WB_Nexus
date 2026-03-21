import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../_shared/crypto.ts";

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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Lovable Cloud client (auth validation) ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: "Unauthorized – JWT validation failed", 
        detail: authError?.message || "No user returned from getUser" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Auth OK for user ${user.id} (${user.email})`);

    // --- Production Supabase client (data persistence) ---
    const prodUrl = Deno.env.get("PROD_SUPABASE_URL");
    const prodServiceKey = Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY");

    if (!prodUrl || !prodServiceKey) {
      return new Response(
        JSON.stringify({ 
          error: "Production Supabase credentials not configured",
          detail: `PROD_SUPABASE_URL=${prodUrl ? "SET" : "MISSING"}, PROD_SUPABASE_SERVICE_ROLE_KEY=${prodServiceKey ? "SET" : "MISSING"}`
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Production URL: ${prodUrl}`);

    const prodSupabase = createClient(prodUrl, prodServiceKey);

    // Also keep a Lovable Cloud service client for meta_connections
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { connection_type } = await req.json();

    const metaAccessToken = Deno.env.get("META_ACCESS_TOKEN");
    const adAccountId = Deno.env.get("META_AD_ACCOUNT_ID");
    const whatsappBusinessAccountId = Deno.env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID");

    if (!metaAccessToken) {
      return new Response(
        JSON.stringify({ error: "META_ACCESS_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Validate Meta token with Graph API ---
    const tokenCheck = await fetch(
      `https://graph.facebook.com/v21.0/me?access_token=${metaAccessToken}`
    );
    if (!tokenCheck.ok) {
      const tokenErr = await tokenCheck.text();
      console.error("Meta token validation failed:", tokenErr);
      return new Response(
        JSON.stringify({ error: "Meta access token is invalid or expired", detail: tokenErr }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Meta token validated OK");

    // --- Check legal_consent on production DB ---
    const { data: consent, error: consentError } = await prodSupabase
      .from("legal_consents")
      .select("user_id, accepted_at, ip_address")
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .limit(1)
      .maybeSingle();

    if (consentError) {
      console.error("Error checking legal_consents:", consentError.message);
      return new Response(
        JSON.stringify({ 
          error: "Erro ao verificar consentimento legal",
          detail: consentError.message,
          hint: consentError.code === "PGRST116" ? "Table legal_consents may not exist" : 
                consentError.code === "42501" ? "Invalid API Key or insufficient permissions (check PROD_SUPABASE_SERVICE_ROLE_KEY)" :
                `Postgres error code: ${consentError.code}`
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Legal consent lookup for user ${user.id}: ${consent ? "FOUND" : "NOT FOUND"}`);

    if (!consent) {
      return new Response(
        JSON.stringify({ 
          error: "User not found in legal_consents",
          detail: `No record with accepted_at for user_id=${user.id}. Insert a consent record before calling connect-meta.`
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Find project on production DB ---
    const { data: project, error: projectError } = await prodSupabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (projectError) {
      return new Response(JSON.stringify({ error: projectError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!project) {
      return new Response(
        JSON.stringify({ error: "No project found. Create a project first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Deactivate old meta_connections (Lovable Cloud) ---
    await supabase
      .from("meta_connections")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("project_id", project.id);

    // --- Insert new meta_connection (Lovable Cloud) ---
    const { error: insertError } = await supabase
      .from("meta_connections")
      .insert({
        project_id: project.id,
        user_id: user.id,
        ad_account_id: adAccountId || null,
        connection_type: connection_type || "imported",
        whatsapp_account_id: whatsappBusinessAccountId || null,
        is_active: true,
      });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Encrypt and write to PRODUCTION projects table ---
    const encryptedToken = await encryptToken(metaAccessToken);

    const { error: updateError } = await prodSupabase
      .from("projects")
      .update({
        meta_access_token: encryptedToken,
        meta_ads_account_id: adAccountId || null,
      })
      .eq("id", project.id);

    if (updateError) {
      console.error("Error updating production project:", updateError.message);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ Meta connected for user ${user.id}, project ${project.id} (production)`);

    return new Response(
      JSON.stringify({
        success: true,
        project_id: project.id,
        ad_account_id: adAccountId,
        connection_type: connection_type || "imported",
        legal_consent_verified: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("connect-meta error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
