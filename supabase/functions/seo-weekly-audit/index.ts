import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/**
 * Auditoria SEO semanal automática.
 * Corre via GitHub Actions cron (semanal). Para todos os projetos com domínio configurado:
 *   1. Chama analyze-seo
 *   2. Se score < 70, cria uma nota em notes_reminders como insight no Dashboard
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Proteção: só corre com cron secret (evita abuso público)
  const cronSecret = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected || cronSecret !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: projects, error } = await admin
      .from("projects")
      .select("id, user_id, name, domain")
      .not("domain", "is", null);

    if (error) throw error;

    const results: Array<{ project: string; score: number | null; flagged: boolean }> = [];

    for (const p of projects ?? []) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/analyze-seo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ projectId: p.id, url: p.domain }),
        });
        const data = await r.json();
        const score = typeof data?.seoScore === "number" ? data.seoScore : null;

        let flagged = false;
        if (score !== null && score < 70) {
          flagged = true;
          await admin.from("notes_reminders").insert({
            user_id: p.user_id,
            type: "insight",
            content: `🔍 Auditoria SEO semanal: ${p.name} obteve ${score}/100. Recomenda-se rever meta tags e conteúdo.`,
          });
        }
        results.push({ project: p.name, score, flagged });
      } catch (e) {
        console.error(`Audit failed for ${p.id}:`, e);
        results.push({ project: p.name, score: null, flagged: false });
      }
    }

    return new Response(
      JSON.stringify({ success: true, audited: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[seo-weekly-audit] error:", e);
    return new Response(JSON.stringify({ error: "Erro interno na auditoria semanal." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
