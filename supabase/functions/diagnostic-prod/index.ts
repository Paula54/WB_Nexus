// Production schema integrity & Meta token diagnostic.
//
// GET  /diagnostic-prod                       -> full schema check (expected vs real columns)
// POST /diagnostic-prod {token: "<plain>"}    -> Meta debug_token (validity, app, scopes, expiry, missing perms)
// POST /diagnostic-prod {project_id: "<id>"}  -> decrypt stored token for project then debug_token it
//
// Read-only. No writes. Safe to call any time.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROD_URL = Deno.env.get("PROD_SUPABASE_URL") || "https://hqyuxponbobmuletqshq.supabase.co";
const PROD_KEY = Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_ID = (Deno.env.get("META_APP_ID") || Deno.env.get("FACEBOOK_APP_ID") || Deno.env.get("NEXT_PUBLIC_FB_APP_ID") || "").trim();
const META_APP_SECRET = (Deno.env.get("META_APP_SECRET") || Deno.env.get("FACEBOOK_APP_SECRET") || "").trim();

const EXPECTED_COLUMNS: Record<string, string[]> = {
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

const REQUIRED_PERMISSIONS = [
  "pages_show_list", "pages_read_engagement", "pages_manage_posts",
  "pages_manage_metadata", "instagram_basic", "instagram_content_publish",
  "ads_management", "ads_read", "business_management",
];

async function checkSchema() {
  const tables: Record<string, Record<string, string>> = {};
  const missing: string[] = [];
  for (const [table, cols] of Object.entries(EXPECTED_COLUMNS)) {
    const colReport: Record<string, string> = {};
    for (const col of cols) {
      const r = await fetch(`${PROD_URL}/rest/v1/${table}?select=${col}&limit=0`, {
        headers: { apikey: PROD_KEY, Authorization: `Bearer ${PROD_KEY}` },
      });
      if (r.ok) {
        colReport[col] = "OK";
      } else {
        colReport[col] = `MISSING (${r.status})`;
        missing.push(`${table}.${col}`);
      }
    }
    tables[table] = colReport;
  }
  return { schema_ok: missing.length === 0, missing_columns: missing, tables };
}

async function debugMetaToken(input_token: string) {
  if (!META_APP_ID || !META_APP_SECRET) {
    return { ok: false, error: "META_APP_ID/META_APP_SECRET não configurados no servidor." };
  }
  const appToken = `${META_APP_ID}|${META_APP_SECRET}`;

  const [dbgRes, permRes, appRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(input_token)}&access_token=${encodeURIComponent(appToken)}`),
    fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(input_token)}`),
    fetch(`https://graph.facebook.com/v21.0/${META_APP_ID}?fields=id,name,namespace,app_type,category,restrictions&access_token=${encodeURIComponent(appToken)}`),
  ]);
  const dbg = await dbgRes.json();
  const perm = await permRes.json();
  const app = await appRes.json();

  const data = dbg.data || {};
  const granted = (perm.data || []).filter((p: any) => p.status === "granted").map((p: any) => p.permission);
  const declined = (perm.data || []).filter((p: any) => p.status === "declined").map((p: any) => p.permission);
  const missing = REQUIRED_PERMISSIONS.filter((p) => !granted.includes(p));

  let diagnosis = "Token válido.";
  if (data.is_valid !== true) {
    if (data.error?.code === 190) diagnosis = "Token EXPIRADO ou revogado. Religar o Facebook.";
    else if (data.app_id && String(data.app_id) !== String(META_APP_ID)) diagnosis = `Token pertence à App ${data.app_id} mas o servidor está configurado para ${META_APP_ID}. Mismatch de App ID.`;
    else diagnosis = data.error?.message || "Token inválido (motivo não especificado pela Meta).";
  } else if (missing.length > 0) {
    diagnosis = `Token válido MAS faltam permissões: ${missing.join(", ")}.`;
  } else if (app.app_type === 0) {
    diagnosis = "Token válido mas a App está em modo Sandbox/Dev — confirma 'App Mode: Live' em developers.facebook.com.";
  }

  return {
    diagnosis,
    valid: data.is_valid === true,
    app_id_in_token: data.app_id || null,
    app_id_configured: META_APP_ID,
    app_id_match: data.app_id ? String(data.app_id) === String(META_APP_ID) : null,
    user_id: data.user_id || null,
    type: data.type || null,
    issued_at: data.issued_at ? new Date(data.issued_at * 1000).toISOString() : null,
    expires_at: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : null,
    data_access_expires_at: data.data_access_expires_at ? new Date(data.data_access_expires_at * 1000).toISOString() : null,
    scopes: data.scopes || [],
    granted_permissions: granted,
    declined_permissions: declined,
    missing_required_permissions: missing,
    meta_error: data.error || dbg.error || null,
    app: { id: app.id, name: app.name, app_type: app.app_type, category: app.category, restrictions: app.restrictions },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method === "GET") {
      const result = await checkSchema();
      return new Response(JSON.stringify({ prod_url: PROD_URL, ...result }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));

    if (body.token) {
      const result = await debugMetaToken(body.token);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.project_id) {
      const supabase = createClient(PROD_URL, PROD_KEY);
      const { data: cred, error } = await supabase
        .from("project_credentials")
        .select("meta_access_token")
        .eq("project_id", body.project_id)
        .maybeSingle();
      if (error || !cred?.meta_access_token) {
        return new Response(JSON.stringify({ error: "Sem token guardado para este projeto.", details: error }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let plain: string;
      try {
        plain = await decryptToken(cred.meta_access_token as string);
      } catch (e) {
        return new Response(JSON.stringify({ error: "Falha a decifrar token guardado", details: (e as Error).message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await debugMetaToken(plain);
      return new Response(JSON.stringify({ project_id: body.project_id, ...result }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Body deve conter {token} ou {project_id}." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
