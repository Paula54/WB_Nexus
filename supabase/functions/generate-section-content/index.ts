import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SectionPayload {
  type: string;
  content: {
    title?: string;
    subtitle?: string;
    buttonText?: string;
    items?: Array<{ title: string; desc: string }>;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const section: SectionPayload | undefined = body?.section;
    if (!section || typeof section.type !== "string") {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI indisponível" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carregar contexto do negócio (service role para passar por cima de cache RLS irrelevante aqui)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const [{ data: profile }, { data: project }, { data: bp }] = await Promise.all([
      admin
        .from("profiles")
        .select("company_name, business_sector")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("projects")
        .select("name, business_sector, description, city, trade_name, business_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin
        .from("business_profiles")
        .select("trade_name, city")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const business = {
      name:
        bp?.trade_name ||
        (project as any)?.business_name ||
        (project as any)?.trade_name ||
        project?.name ||
        profile?.company_name ||
        "o negócio",
      sector:
        (project as any)?.business_sector || (profile as any)?.business_sector || "geral",
      description: (project as any)?.description || "",
      city: (bp as any)?.city || (project as any)?.city || "Portugal",
    };

    const prompt = `És um copywriter sénior em PT-PT. Reescreve esta secção de website para o negócio abaixo, eliminando placeholders genéricos e usando linguagem clara, persuasiva e específica do setor.

NEGÓCIO:
- Nome: ${business.name}
- Setor: ${business.sector}
- Cidade: ${business.city}
- Descrição: ${business.description || "(sem descrição)"}

SECÇÃO ATUAL (tipo: ${section.type}):
${JSON.stringify(section.content, null, 2)}

Regras:
- Mantém EXATAMENTE a mesma estrutura JSON (mesmos campos: title, subtitle, buttonText, items)
- Se houver items, mantém a mesma quantidade
- Português de Portugal, tom profissional mas humano
- Sem emojis, sem aspas, sem markdown
- Devolve APENAS o JSON do campo "content"`;

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: "Devolves APENAS JSON válido, nunca texto extra." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!res.ok) {
      const t = await res.text();
      console.warn("[generate-section-content] gemini error:", res.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar conteúdo" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content;
    let content: any = section.content;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      content = parsed?.content ?? parsed;
    } catch (e) {
      console.warn("[generate-section-content] parse fallback:", e);
    }

    return new Response(
      JSON.stringify({ success: true, content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[generate-section-content] error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
