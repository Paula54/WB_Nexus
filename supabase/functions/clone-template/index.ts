import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SectionContent {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  items?: Array<{ title: string; desc: string }>;
  backgroundImage?: string;
  html?: string;
}

interface TemplateSection {
  type: string;
  sort_order: number;
  content: SectionContent;
}

async function personalizeWithAI(
  sections: TemplateSection[],
  business: {
    name?: string | null;
    sector?: string | null;
    description?: string | null;
    city?: string | null;
  },
  apiKey: string,
): Promise<TemplateSection[]> {
  const prompt = `Personaliza estas secções de um site para o negócio abaixo. Mantém a estrutura JSON exata.
Substitui placeholders e textos genéricos por conteúdo específico do negócio em Português de Portugal.

NEGÓCIO:
- Nome: ${business.name || "Negócio"}
- Setor: ${business.sector || "Geral"}
- Descrição: ${business.description || "Sem descrição"}
- Cidade: ${business.city || "Portugal"}

SECÇÕES A PERSONALIZAR (JSON):
${JSON.stringify(sections, null, 2)}

RETORNA APENAS o JSON modificado, sem markdown nem explicações. Mantém o formato exato dos campos (title, subtitle, buttonText, items, backgroundImage, html).`;

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: "Devolves APENAS JSON válido, nunca texto adicional." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    },
  );

  if (!res.ok) {
    const t = await res.text();
    console.warn("[clone-template] AI fallback (no personalization):", res.status, t);
    return sections;
  }

  try {
    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content;
    if (!raw) return sections;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    // Aceita tanto { sections: [...] } como array direto
    const out = Array.isArray(parsed) ? parsed : parsed.sections;
    if (Array.isArray(out) && out.length === sections.length) {
      return out as TemplateSection[];
    }
    return sections;
  } catch (e) {
    console.warn("[clone-template] parse fallback:", e);
    return sections;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente para validar utilizador (usa o JWT do utilizador)
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { templateId, targetPageId, projectId } = body || {};
    if (!templateId || !targetPageId || !projectId) {
      return new Response(JSON.stringify({ error: "Parâmetros em falta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente service-role para ler templates e escrever secções
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Validar que a página alvo é do utilizador
    const { data: targetPage, error: tgtErr } = await admin
      .from("pages")
      .select("id, user_id, project_id")
      .eq("id", targetPageId)
      .maybeSingle();
    if (tgtErr || !targetPage || targetPage.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Página inválida" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Validar que o template existe e é template
    const { data: template, error: tplErr } = await admin
      .from("pages")
      .select("id, is_template")
      .eq("id", templateId)
      .maybeSingle();
    if (tplErr || !template || !template.is_template) {
      return new Response(JSON.stringify({ error: "Modelo não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Carregar secções do template
    const { data: tplSections } = await admin
      .from("page_sections")
      .select("type, sort_order, content")
      .eq("page_id", templateId)
      .order("sort_order", { ascending: true });

    if (!tplSections || tplSections.length === 0) {
      return new Response(JSON.stringify({ error: "Modelo sem conteúdo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Carregar contexto do negócio do utilizador
    const [{ data: profile }, { data: project }, { data: bp }] = await Promise.all([
      admin.from("profiles").select("company_name, business_sector").eq("user_id", user.id).maybeSingle(),
      admin.from("projects").select("name, business_sector, description, city").eq("id", projectId).maybeSingle(),
      admin.from("business_profiles").select("trade_name, city").eq("user_id", user.id).maybeSingle(),
    ]);

    const business = {
      name: bp?.trade_name || project?.name || profile?.company_name || null,
      sector: project?.business_sector || profile?.business_sector || null,
      description: project?.description || null,
      city: bp?.city || project?.city || null,
    };

    // 5) Personalizar via Gemini (com fallback se falhar)
    let personalized = tplSections as TemplateSection[];
    if (GEMINI_API_KEY) {
      personalized = await personalizeWithAI(personalized, business, GEMINI_API_KEY);
    }

    // 6) Garantir landing_page_id (legacy fk)
    let landingPageId: string;
    const { data: lp } = await admin
      .from("landing_pages")
      .select("id")
      .eq("project_id", projectId)
      .limit(1)
      .maybeSingle();
    if (lp) {
      landingPageId = lp.id;
    } else {
      const { data: newLp, error: lpErr } = await admin
        .from("landing_pages")
        .insert({ project_id: projectId, user_id: user.id, name: "Site", slug: "index" })
        .select("id")
        .single();
      if (lpErr || !newLp) {
        return new Response(JSON.stringify({ error: "Erro ao criar landing page" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      landingPageId = newLp.id;
    }

    // 7) Limpar secções existentes da página alvo
    await admin.from("page_sections").delete().eq("page_id", targetPageId);

    // 8) Inserir novas secções personalizadas
    const rows = personalized.map((s, i) => ({
      landing_page_id: landingPageId,
      page_id: targetPageId,
      user_id: user.id,
      type: s.type,
      sort_order: i,
      content: s.content as unknown as Record<string, unknown>,
    }));

    const { error: insErr } = await admin.from("page_sections").insert(rows);
    if (insErr) {
      console.error("[clone-template] insert error:", insErr);
      return new Response(JSON.stringify({ error: "Erro ao guardar secções" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, sections_count: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[clone-template] internal error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
