import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic } = await req.json();
    if (!topic || typeof topic !== "string") {
      return new Response(JSON.stringify({ error: "Tema é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const systemPrompt = `Tu és um redator de conteúdo SEO especializado para a plataforma WB Nexus (Web Business). 
Gera artigos de blog em Português de Portugal, otimizados para SEO.

Regras:
- Usa Markdown para formatação
- Inclui um título H1 forte com a keyword principal
- Usa H2 e H3 para estruturar o conteúdo
- Inclui uma introdução cativante (2-3 parágrafos)
- Desenvolve 3-5 secções principais com H2
- Usa sub-secções H3 quando relevante
- Termina com uma conclusão e call-to-action
- O tom deve ser profissional mas acessível
- Inclui keywords naturais ao longo do texto
- Gera também um excerpt/resumo de 1-2 frases para meta description

Formato de resposta obrigatório (JSON):
{
  "title": "Título do artigo",
  "slug": "titulo-do-artigo",
  "content": "Conteúdo completo em Markdown",
  "excerpt": "Resumo curto para SEO (max 160 chars)"
}`;

    const response = await fetch(
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
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Gera um artigo de blog completo sobre o seguinte tema: "${topic}"`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_blog_post",
                description: "Creates a structured blog post with SEO optimization",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Blog post title" },
                    slug: { type: "string", description: "URL-friendly slug" },
                    content: { type: "string", description: "Full markdown content" },
                    excerpt: { type: "string", description: "Short SEO excerpt (max 160 chars)" },
                  },
                  required: ["title", "slug", "content", "excerpt"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "create_blog_post" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de pedidos excedido. Tenta novamente em breve." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adiciona créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("Erro ao gerar artigo");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    let blogPost;
    if (toolCall?.function?.arguments) {
      blogPost = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try to parse from content
      const content = data.choices?.[0]?.message?.content ?? "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        blogPost = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Formato de resposta inesperado da IA");
      }
    }

    return new Response(JSON.stringify(blogPost), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-blog-post] internal error:", err);
    return new Response(
      JSON.stringify({ error: "Ocorreu um erro interno ao gerar o artigo." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
