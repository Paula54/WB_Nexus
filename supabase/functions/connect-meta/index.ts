import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(
  message: string,
  status: number,
  diagnostics: Record<string, unknown> = {},
): Response {
  return jsonResponse({ ok: false, error: message, diagnostics }, status);
}

function normalizeError(error: unknown): { message: string; details: Record<string, unknown> } {
  if (error instanceof Error) {
    return { message: error.message, details: { name: error.name, stack: error.stack } };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = [record.message, record.details, record.hint, record.code]
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .join(" · ");

    return {
      message: message || JSON.stringify(record),
      details: record,
    };
  }

  return { message: String(error || "Erro desconhecido"), details: {} };
}

function isSchemaCacheColumnError(error: unknown, table: string) {
  if (!error || typeof error !== "object") return false;

  const record = error as Record<string, unknown>;
  const haystack = [record.message, record.details, record.hint, record.code]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();

  return haystack.includes("schema cache") && haystack.includes(`'${table.toLowerCase()}'`);
}

async function ensurePrimaryProject(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userEmail?: string | null,
  fallbackPlan = "START",
) {
  const { data: existingProject, error: lookupError } = await supabase
    .from("projects")
    .select("id, name, selected_plan")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existingProject) {
    return existingProject;
  }

  const { data: newProject, error: createError } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name: `Projeto Nexus OS - ${userEmail || userId.slice(0, 8)}`,
      project_type: "marketing",
      selected_plan: fallbackPlan,
    })
    .select("id, name, selected_plan")
    .single();

  if (createError || !newProject) {
    throw createError || new Error("Failed to create project");
  }

  return newProject;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const log = (msg: string, data?: unknown) => console.log(`[${requestId}] ${msg}`, data !== undefined ? JSON.stringify(data) : "");
  const logError = (msg: string, data?: unknown) => console.error(`[${requestId}] ❌ ${msg}`, data !== undefined ? JSON.stringify(data) : "");

  log(`➡️ ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- GET: Webhook verification ---
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode && token && challenge) {
      const VERIFY_TOKEN = Deno.env.get("VERIFY_TOKEN") || Deno.env.get("META_VERIFY_TOKEN") || "nexus2026";
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        log("✅ Webhook verified");
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      return new Response("Forbidden", { status: 403 });
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- POST: Receive user's short-lived token from FB SDK, exchange & store ---
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logError("Missing Authorization header");
      return errorResponse("Sessão inválida: falta autorização.", 401, { stage: "auth_header" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      logError("Auth failed", authError?.message);
      return errorResponse("Sessão inválida ou expirada. Entra novamente na app.", 401, { stage: "auth_user" });
    }
    log(`✅ User=${user.id}`);

    const body = await req.json();
    const shortLivedToken = body.access_token;
    const connectionType = body.connection_type || "imported";

    if (!shortLivedToken) {
      logError("No access_token in body");
      return errorResponse("Token do Facebook em falta. Repete o login com Facebook.", 400, { stage: "request_body" });
    }

    // --- Exchange short-lived for long-lived token ---
    const META_APP_ID = (Deno.env.get("META_APP_ID") || Deno.env.get("FACEBOOK_APP_ID") || Deno.env.get("NEXT_PUBLIC_FB_APP_ID") || Deno.env.get("VITE_FACEBOOK_APP_ID") || "").trim();
    const META_APP_SECRET = (Deno.env.get("META_APP_SECRET") || Deno.env.get("FACEBOOK_APP_SECRET") || "").trim();

    if (!META_APP_ID || !META_APP_SECRET) {
      logError("META_APP_ID or META_APP_SECRET not configured");
      return errorResponse("Credenciais da App Meta em falta no servidor.", 500, { stage: "meta_credentials" });
    }

    log("🔄 Exchanging short-lived token for long-lived...");
    const exchangeRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`
    );
    const exchangeData = await exchangeRes.json();

    if (exchangeData.error) {
      logError("Token exchange failed", exchangeData.error);
      const fb = exchangeData.error || {};
      const guidance = fb.code === 190
        ? "Token expirado ou inválido. Volta a iniciar sessão no Facebook."
        : fb.code === 100
          ? "Parâmetros inválidos. Verifica se o App ID corresponde ao que está em Meta for Developers."
          : fb.code === 200 || fb.type === "OAuthException"
            ? "Permissões insuficientes. Aceita TODAS as permissões pedidas (páginas, ads, instagram)."
            : "Falha na troca de token com a Meta. Tenta novamente daqui a alguns minutos.";
      return errorResponse(fb.message || "Falha na troca de token com a Meta.", 400, {
        stage: "token_exchange",
        code: fb.code ?? null,
        subcode: fb.error_subcode ?? null,
        type: fb.type ?? null,
        fbtrace_id: fb.fbtrace_id ?? null,
        guidance,
      });
    }

    const longLivedToken = exchangeData.access_token;
    const expiresIn = exchangeData.expires_in || 5184000;
    log(`✅ Long-lived token obtained, expires in ${expiresIn}s`);

    // --- Fetch Facebook Pages ---
    let facebookPageId: string | null = null;
    let instagramBusinessId: string | null = null;

    try {
      log("📘 Fetching Facebook Pages...");
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${longLivedToken}`
      );
      const pagesData = await pagesRes.json();
      log("📘 Pages", { count: pagesData.data?.length });

      if (pagesData.data?.length > 0) {
        facebookPageId = pagesData.data[0].id;
        if (pagesData.data[0].instagram_business_account?.id) {
          instagramBusinessId = pagesData.data[0].instagram_business_account.id;
        }
      }
    } catch (e) {
      logError("Error fetching pages", e);
    }

    // --- Fetch Ad Account ---
    let adAccountId: string | null = null;
    try {
      const adRes = await fetch(
        `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name&access_token=${longLivedToken}`
      );
      const adData = await adRes.json();
      if (adData.data?.length > 0) {
        adAccountId = adData.data[0].id;
      }
      log("📊 Ad accounts", { count: adData.data?.length, selected: adAccountId });
    } catch (e) {
      logError("Error fetching ad accounts", e);
    }

    // --- Encrypt & Store ---
    const prodUrl = Deno.env.get("PROD_SUPABASE_URL") || "https://hqyuxponbobmuletqshq.supabase.co";
    const prodServiceKey = Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!prodUrl || !prodServiceKey) {
      logError("Production credentials not configured");
      return errorResponse("Credenciais de produção em falta no servidor.", 500, { stage: "database_credentials" });
    }
    const prodSupabase = createClient(prodUrl, prodServiceKey);

    let project;
    try {
      project = await ensurePrimaryProject(prodSupabase, user.id, user.email, "START");
    } catch (projectError) {
      const normalized = normalizeError(projectError);
      logError("Project lookup failed", normalized);
      return errorResponse(`Não foi possível encontrar ou criar o projeto: ${normalized.message}`, 500, {
        stage: "project_lookup",
        guidance: "Confirma que a sessão pertence ao ambiente de produção e volta a iniciar sessão se necessário.",
        ...normalized.details,
      });
    }

    if (!project) {
      return errorResponse("Não foi possível identificar o projeto principal.", 500, { stage: "project_lookup" });
    }

    log(`📁 Project: ${project.id}`);

    // Encrypt token
    log("🔒 Encrypting token...");
    const encryptedToken = await encryptToken(longLivedToken);

    // Upsert project_credentials instead of projects
    const credentialsPayload = {
      project_id: project.id,
      user_id: user.id,
      meta_access_token: encryptedToken,
      meta_ads_account_id: adAccountId,
      facebook_page_id: facebookPageId,
      instagram_business_id: instagramBusinessId,
      updated_at: new Date().toISOString(),
    };
    log("💾 Saving project_credentials (select-then-insert/update)...", { project_id: project.id });

    const { data: existingCred, error: existingCredError } = await prodSupabase
      .from("project_credentials")
      .select("id")
      .eq("project_id", project.id)
      .maybeSingle();

    if (existingCredError) {
      const normalized = normalizeError(existingCredError);
      logError("project_credentials lookup failed", existingCredError);
      return errorResponse(normalized.message, 500, { stage: "project_credentials_lookup", ...normalized.details });
    }

    let upsertError: any = null;
    if (existingCred) {
      const { error } = await prodSupabase
        .from("project_credentials")
        .update(credentialsPayload)
        .eq("id", (existingCred as any).id);
      upsertError = error;
    } else {
      const { error } = await prodSupabase
        .from("project_credentials")
        .insert(credentialsPayload);
      upsertError = error;
    }

    if (upsertError) {
      const normalized = normalizeError(upsertError);
      logError("project_credentials upsert failed", upsertError);
      return errorResponse(normalized.message, 500, { stage: "project_credentials_upsert", ...normalized.details });
    }

    // Mirror Meta IDs to projects table (consistency for Dashboard)
    await prodSupabase
      .from("projects")
      .update({
        meta_access_token: encryptedToken,
        facebook_page_id: facebookPageId,
        instagram_business_id: instagramBusinessId,
        meta_ads_account_id: adAccountId,
      })
      .eq("id", project.id);

    // Encrypt page access token if we have a page
    let encryptedPageToken: string | null = null;
    if (facebookPageId && longLivedToken) {
      try {
        log("📘 Fetching page access token...");
        const pageTokenRes = await fetch(
          `https://graph.facebook.com/v21.0/${facebookPageId}?fields=access_token&access_token=${longLivedToken}`
        );
        const pageTokenData = await pageTokenRes.json();
        if (pageTokenData.access_token) {
          encryptedPageToken = await encryptToken(pageTokenData.access_token);
          log("✅ Page access token encrypted");
        }
      } catch (e) {
        logError("Error fetching page token", e);
      }
    }

    // Save meta_connection — REQUIRED. No fallback.
    const metaConnectionPayload = {
      project_id: project.id,
      user_id: user.id,
      ad_account_id: adAccountId,
      connection_type: connectionType,
      instagram_business_id: instagramBusinessId,
      facebook_page_id: facebookPageId,
      page_access_token: encryptedPageToken,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data: existingMetaConnection, error: metaLookupError } = await prodSupabase
      .from("meta_connections")
      .select("id")
      .eq("project_id", project.id)
      .maybeSingle();

    if (metaLookupError) {
      logError("meta_connections lookup failed", metaLookupError);
      return errorResponse(
        `meta_connections lookup falhou: ${metaLookupError.message}`,
        500,
        {
          stage: "meta_connections_lookup",
          guidance: "Schema de produção desalinhado. Corre o SQL de schema-fix antes de tentar novamente.",
          ...normalizeError(metaLookupError).details,
        },
      );
    }

    const { error: metaWriteError } = existingMetaConnection
      ? await prodSupabase
          .from("meta_connections")
          .update(metaConnectionPayload)
          .eq("id", existingMetaConnection.id)
      : await prodSupabase
          .from("meta_connections")
          .insert({
            ...metaConnectionPayload,
            created_at: new Date().toISOString(),
          });

    if (metaWriteError) {
      logError("meta_connections write failed", metaWriteError);
      return errorResponse(
        `meta_connections write falhou: ${metaWriteError.message}`,
        500,
        {
          stage: "meta_connections_write",
          guidance: "Schema de produção desalinhado. Corre o SQL de schema-fix antes de tentar novamente.",
          ...normalizeError(metaWriteError).details,
        },
      );
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const result = {
      success: true,
      project_id: project.id,
      facebook_page_id: facebookPageId,
      instagram_business_id: instagramBusinessId,
      ad_account_id: adAccountId,
      token_expires_at: expiresAt,
    };
    log("✅ connect-meta completed", result);

    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    const normalized = normalizeError(err);
    logError("Unhandled error", normalized);
    return errorResponse(normalized.message || "Erro interno desconhecido no connect-meta", 500, {
      stage: "unhandled_exception",
      type: String(normalized.details.name || "InternalError"),
      guidance: "Erro inesperado no servidor. Reenvia o request; se persistir, contacta o suporte com o request_id.",
      request_id: requestId,
      ...normalized.details,
    });
  }
});
