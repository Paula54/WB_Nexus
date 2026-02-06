import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PageSpeedResult {
  performanceScore: number;
  metrics: {
    fcp: number;
    lcp: number;
    cls: number;
    tbt: number;
    si: number;
  };
}

interface HtmlAnalysis {
  title: string | null;
  metaDescription: string | null;
  hasH1: boolean;
  h1Text: string | null;
  missingAltCount: number;
  totalImages: number;
  hasCanonical: boolean;
  hasViewport: boolean;
  wordCount: number;
}

async function getPageSpeedData(url: string, apiKey: string): Promise<PageSpeedResult | null> {
  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=performance&category=seo&strategy=mobile&key=${apiKey}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error("PageSpeed API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const lighthouse = data.lighthouseResult;

    if (!lighthouse) return null;

    const perfScore = Math.round((lighthouse.categories?.performance?.score || 0) * 100);
    const audits = lighthouse.audits || {};

    return {
      performanceScore: perfScore,
      metrics: {
        fcp: audits["first-contentful-paint"]?.numericValue || 0,
        lcp: audits["largest-contentful-paint"]?.numericValue || 0,
        cls: audits["cumulative-layout-shift"]?.numericValue || 0,
        tbt: audits["total-blocking-time"]?.numericValue || 0,
        si: audits["speed-index"]?.numericValue || 0,
      },
    };
  } catch (error) {
    console.error("PageSpeed fetch error:", error);
    return null;
  }
}

async function analyzeHtml(url: string): Promise<HtmlAnalysis> {
  const defaults: HtmlAnalysis = {
    title: null,
    metaDescription: null,
    hasH1: false,
    h1Text: null,
    missingAltCount: 0,
    totalImages: 0,
    hasCanonical: false,
    hasViewport: false,
    wordCount: 0,
  };

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "NexusAI SEO Auditor/1.0" },
    });

    if (!response.ok) return defaults;

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    defaults.title = titleMatch ? titleMatch[1].trim() : null;

    // Extract meta description
    const metaDescMatch = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
      || html.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
    defaults.metaDescription = metaDescMatch ? metaDescMatch[1].trim() : null;

    // Check H1
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
    defaults.hasH1 = !!h1Match;
    defaults.h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, "").trim() : null;

    // Check images and alt tags
    const imgMatches = html.match(/<img\s[^>]*>/gi) || [];
    defaults.totalImages = imgMatches.length;
    defaults.missingAltCount = imgMatches.filter(
      (img) => !img.match(/alt=["'][^"']+["']/i)
    ).length;

    // Check canonical
    defaults.hasCanonical = /<link\s[^>]*rel=["']canonical["'][^>]*>/i.test(html);

    // Check viewport
    defaults.hasViewport = /<meta\s[^>]*name=["']viewport["'][^>]*>/i.test(html);

    // Estimate word count (strip tags, count words)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    defaults.wordCount = textContent.split(/\s+/).filter((w) => w.length > 2).length;

    return defaults;
  } catch (error) {
    console.error("HTML analysis error:", error);
    return defaults;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Analyzing SEO for:", formattedUrl);

    // Run PageSpeed and HTML analysis in parallel
    const [pageSpeedData, htmlAnalysis] = await Promise.all([
      getPageSpeedData(formattedUrl, GOOGLE_API_KEY),
      analyzeHtml(formattedUrl),
    ]);

    // Build context for Gemini
    const analysisContext = `
Dados reais de auditoria SEO para o site: ${formattedUrl}

## Performance (Google PageSpeed Insights - Mobile)
${pageSpeedData ? `
- Score de Performance: ${pageSpeedData.performanceScore}/100
- First Contentful Paint: ${(pageSpeedData.metrics.fcp / 1000).toFixed(1)}s
- Largest Contentful Paint: ${(pageSpeedData.metrics.lcp / 1000).toFixed(1)}s
- Cumulative Layout Shift: ${pageSpeedData.metrics.cls.toFixed(3)}
- Total Blocking Time: ${pageSpeedData.metrics.tbt.toFixed(0)}ms
- Speed Index: ${(pageSpeedData.metrics.si / 1000).toFixed(1)}s
` : "- Não foi possível obter dados do PageSpeed Insights."}

## Análise HTML
- Título da página: ${htmlAnalysis.title || "NÃO ENCONTRADO ❌"}
- Meta Description: ${htmlAnalysis.metaDescription || "NÃO ENCONTRADA ❌"}
- Tag H1: ${htmlAnalysis.hasH1 ? `Presente ✅ ("${htmlAnalysis.h1Text}")` : "AUSENTE ❌"}
- Imagens totais: ${htmlAnalysis.totalImages}
- Imagens sem alt text: ${htmlAnalysis.missingAltCount}
- Tag Canonical: ${htmlAnalysis.hasCanonical ? "Presente ✅" : "AUSENTE ❌"}
- Meta Viewport: ${htmlAnalysis.hasViewport ? "Presente ✅" : "AUSENTE ❌"}
- Contagem de palavras: ~${htmlAnalysis.wordCount}
`;

    // Send to Gemini for personalized analysis
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        tools: [
          {
            type: "function",
            function: {
              name: "seo_audit_result",
              description: "Retorna os resultados da auditoria SEO formatados.",
              parameters: {
                type: "object",
                properties: {
                  score: {
                    type: "number",
                    description: "Score SEO geral de 0 a 100, calculado com base nos dados reais.",
                  },
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        priority: { type: "string", enum: ["alta", "media", "baixa"] },
                        text: { type: "string", description: "Sugestão de melhoria concisa em português de Portugal (máx 100 chars)" },
                      },
                      required: ["priority", "text"],
                    },
                    description: "Lista de 5-8 sugestões de melhoria ordenadas por prioridade.",
                  },
                  keywords: {
                    type: "array",
                    items: { type: "string" },
                    description: "5-10 keywords reais que o site transmite baseado no título, H1, meta description e conteúdo.",
                  },
                  summary: {
                    type: "string",
                    description: "Resumo executivo de 2-3 frases sobre o estado SEO do site, em português de Portugal.",
                  },
                },
                required: ["score", "suggestions", "keywords", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "seo_audit_result" } },
        messages: [
          {
            role: "system",
            content: `És um auditor de SEO profissional. Analisa os dados reais fornecidos e gera uma auditoria completa em Português de Portugal.

Regras para calcular o Score SEO (0-100):
- Base: score de performance do PageSpeed (peso 40%)
- Título presente e < 60 chars: +10 pontos
- Meta description presente e < 160 chars: +10 pontos
- H1 presente: +10 pontos
- Sem imagens sem alt text: +10 pontos
- Canonical presente: +5 pontos
- Viewport presente: +5 pontos
- Conteúdo com >300 palavras: +10 pontos

As sugestões devem ser ACIONÁVEIS e ESPECÍFICAS ao site analisado, não genéricas.
As keywords devem ser EXTRAÍDAS dos dados reais (título, H1, meta description, conteúdo).`,
          },
          {
            role: "user",
            content: analysisContext,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("AI did not return structured data");
    }

    let auditResult;
    try {
      auditResult = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Failed to parse AI response");
    }

    // Combine with raw performance data
    const finalResult = {
      ...auditResult,
      performanceScore: pageSpeedData?.performanceScore ?? null,
      metrics: pageSpeedData?.metrics ?? null,
      htmlAnalysis: {
        title: htmlAnalysis.title,
        metaDescription: htmlAnalysis.metaDescription,
        hasH1: htmlAnalysis.hasH1,
        h1Text: htmlAnalysis.h1Text,
        missingAltCount: htmlAnalysis.missingAltCount,
        totalImages: htmlAnalysis.totalImages,
        hasCanonical: htmlAnalysis.hasCanonical,
        hasViewport: htmlAnalysis.hasViewport,
        wordCount: htmlAnalysis.wordCount,
      },
      analyzedAt: new Date().toISOString(),
      url: formattedUrl,
    };

    console.log("SEO audit complete. Score:", finalResult.score);

    return new Response(JSON.stringify(finalResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("SEO analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
