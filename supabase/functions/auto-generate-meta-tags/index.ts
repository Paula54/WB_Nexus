import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Gera title (<60 chars) e meta description (<160 chars) optimizados para o sector,
 * usando Gemini, e persiste em pages.content.seo = { title, description }.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pageId, projectId } = await req.json();
    if (!pageId || !projectId) {
      return new Response(JSON.stringify({ error: "pageId e projectId obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: page } = await supabase
      .from("pages")
      .select("id, title, slug, content")
      .eq("id", pageId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: project } = await supabase
      .from("projects")
      .select("name, business_sector, description, trade_name")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!page || !project) {
      return new Response(JSON.stringify({ error: "Página ou projeto não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const business = project.trade_name || project.name;
    const sector = project.business_sector || "negócio";

    const prompt = `És um especialista em SEO para o mercado português.
Gera title e meta description optimizados para esta página:
- Negócio: ${business}
- Sector: ${sector}
- Página: ${page.title}
- Slug: ${page.slug}
- Descrição do negócio: ${project.description || "n/a"}

Regras estritas:
- title: máximo 60 caracteres, com keyword principal do sector
- description: máximo 160 caracteres, com call-to-action subtil
- PT-PT (não PT-BR)
- Sem emojis

Responde APENAS em JSON válido: {"title": "...", "description": "..."}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      }
    );
    const gd = await geminiRes.json();
    const raw = gd?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error("Gemini sem resposta");

    const seo = JSON.parse(raw);
    const title = String(seo.title || "").slice(0, 60);
    const description = String(seo.description || "").slice(0, 160);

    const existing = (page.content && typeof page.content === "object") ? page.content as Record<string, unknown> : {};
    const newContent = { ...existing, seo: { title, description } };

    await supabase
      .from("pages")
      .update({ content: newContent })
      .eq("id", pageId)
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ success: true, title, description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[auto-generate-meta-tags] error:", e);
    return new Response(JSON.stringify({ error: "Erro ao gerar meta tags." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
