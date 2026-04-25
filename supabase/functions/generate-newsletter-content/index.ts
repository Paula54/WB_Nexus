import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const briefing: string = (body.briefing || "").toString().slice(0, 2000);
    const assetUrls: string[] = Array.isArray(body.asset_urls) ? body.asset_urls.slice(0, 5) : [];
    const tone: string = (body.tone || "profissional e inspirador").toString();

    if (!briefing.trim()) {
      return new Response(JSON.stringify({ error: "Briefing obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Spend AI Fuel (10 credits for newsletter)
    const { data: spent } = await supabase.rpc("spend_credits", {
      p_action: "newsletter_generate",
      p_cost: 10,
    });
    if (!spent) {
      return new Response(JSON.stringify({ error: "Sem AI Fuel suficiente. Recarrega a tua carteira." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get sector/business context
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_sector, company_name, ai_custom_instructions")
      .eq("user_id", user.id)
      .maybeSingle();

    const sector = profile?.business_sector || "negócio";
    const companyName = profile?.company_name || "a empresa";

    const imagesBlock = assetUrls.length
      ? `\n\nIncluir as seguintes imagens (HTML <img> com style="max-width:100%;height:auto;border-radius:8px;margin:16px 0;display:block;"):\n${assetUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
      : "";

    const customCtx = profile?.ai_custom_instructions
      ? `\nContexto adicional: ${profile.ai_custom_instructions}`
      : "";

    const systemPrompt = `És um copywriter especialista em email marketing PT-PT. Escreves para o sector "${sector}" em nome de "${companyName}". Tom: ${tone}.

REGRAS:
- Devolve APENAS HTML para o CORPO do email (sem <html>, <head>, <body>, sem header/footer — esses já existem no template).
- Estrutura: <h2> com título cativante, 2-3 <p> de conteúdo, opcional <ul>, e um <a> botão CTA com style inline.
- Usa style inline em todas as tags (cores, fontes). Exemplo CTA:
  <a href="#" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">Saber mais</a>
- Português de Portugal. Sem clichés genéricos. Foco em valor para o leitor.${customCtx}`;

    const userPrompt = `Briefing: ${briefing}${imagesBlock}\n\nDevolve apenas o HTML do corpo.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const t = await geminiRes.text();
      console.error("Gemini error:", geminiRes.status, t);
      return new Response(JSON.stringify({ error: "Falha na geração de conteúdo." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiRes.json();
    let html = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Strip code fences if model adds them
    html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    // Suggest a subject too
    const subject = await suggestSubject(briefing, sector, GEMINI_API_KEY);

    return new Response(JSON.stringify({ html, subject }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-newsletter-content] error:", e);
    return new Response(JSON.stringify({ error: "Ocorreu um erro ao gerar o conteúdo." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function suggestSubject(briefing: string, sector: string, key: string): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: `Sugere um único assunto de email curto (máx 60 chars) em PT-PT para o sector "${sector}" sobre: ${briefing}. Devolve APENAS o assunto, sem aspas.` }],
          }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 60 },
        }),
      }
    );
    const d = await res.json();
    return (d?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim().slice(0, 100).replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}
