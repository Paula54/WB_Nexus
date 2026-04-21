// Edge Function: delete-user-data
// Apaga todos os dados do utilizador autenticado usando service_role.
// Requer JWT válido no header Authorization.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tabelas com coluna user_id (apagar diretamente)
const USER_TABLES = [
  "ads_campaigns",
  "assets",
  "blog_posts", // author_id (tratado abaixo)
  "business_profiles",
  "compliance_pages",
  "concierge_conversations",
  "cookie_consent_settings",
  "domain_registrations",
  "email_campaigns",
  "google_ads_accounts",
  "google_analytics_connections",
  "landing_pages",
  "leads",
  "legal_consents",
  "meta_connections",
  "notes_reminders",
  "nx_usage_credits",
  "page_sections",
  "pages",
  "project_credentials",
  "social_posts",
  "subscribers",
  "subscriptions",
  "user_templates",
  "wallet_transactions",
  "user_roles",
  "profiles",
  "projects",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validar JWT
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Cliente com service_role para apagar tudo
    const admin = createClient(supabaseUrl, serviceKey);

    const errors: Record<string, string> = {};

    // Apagar conversation_messages via leads do user (cascade lógico)
    try {
      const { data: leadIds } = await admin
        .from("leads")
        .select("id")
        .eq("user_id", userId);
      if (leadIds && leadIds.length > 0) {
        const ids = leadIds.map((l) => l.id);
        const { error } = await admin
          .from("conversation_messages")
          .delete()
          .in("lead_id", ids);
        if (error) errors["conversation_messages"] = error.message;
      }
    } catch (e) {
      errors["conversation_messages"] = String(e);
    }

    // Apagar tabelas com user_id
    for (const table of USER_TABLES) {
      try {
        const column = table === "blog_posts" ? "author_id" : "user_id";
        const { error } = await admin.from(table).delete().eq(column, userId);
        if (error) errors[table] = error.message;
      } catch (e) {
        errors[table] = String(e);
      }
    }

    // Apagar utilizador do auth (último passo)
    try {
      const { error: deleteUserError } =
        await admin.auth.admin.deleteUser(userId);
      if (deleteUserError) errors["auth.users"] = deleteUserError.message;
    } catch (e) {
      errors["auth.users"] = String(e);
    }

    const hadErrors = Object.keys(errors).length > 0;
    console.log(
      `[delete-user-data] user=${userId} errors=${JSON.stringify(errors)}`,
    );

    return new Response(
      JSON.stringify({
        success: !hadErrors,
        message: hadErrors
          ? "Conta eliminada com avisos"
          : "Conta e dados eliminados com sucesso",
        errors: hadErrors ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[delete-user-data] fatal:", err);
    return new Response(
      JSON.stringify({ error: "Erro ao eliminar a conta" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
