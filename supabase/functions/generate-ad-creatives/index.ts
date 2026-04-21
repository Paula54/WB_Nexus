import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product, audience } = await req.json();

    if (!product) {
      return new Response(JSON.stringify({ error: "product is required", ads: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) {
      console.error("Missing LOVABLE_API_KEY");
      return new Response(
        JSON.stringify({ error: "Configuração de IA em falta. Contacta o suporte.", ads: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `És um copywriter publicitário sénior em português de Portugal. Geras anúncios persuasivos, curtos e com CTA claros.`;

    const userPrompt = `Gera exactamente 3 anúncios criativos em português de Portugal.

Produto/Serviço: ${product}
${audience ? `Público-alvo: ${audience}` : ""}

Cada anúncio deve ter:
- headline: título curto e impactante (máx 30 caracteres)
- body: texto persuasivo (máx 90 caracteres)
- cta: call-to-action curto (ex: "Saber Mais", "Comprar Agora")`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_ads",
              description: "Devolve 3 anúncios criativos estruturados",
              parameters: {
                type: "object",
                properties: {
                  ads: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        headline: { type: "string" },
                        body: { type: "string" },
                        cta: { type: "string" },
                      },
                      required: ["headline", "body", "cta"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["ads"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_ads" } },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`AI gateway HTTP ${res.status}: ${errBody.slice(0, 500)}`);

      if (res.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de pedidos atingido. Tenta novamente em instantes.", ads: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (res.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adiciona fundos à workspace.", ads: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "A IA não respondeu. Tenta novamente em instantes.", ads: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;

    if (!argsStr) {
      console.error("No tool call in response:", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Formato de resposta inválido.", ads: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: { ads?: unknown };
    try {
      parsed = JSON.parse(argsStr);
    } catch (e) {
      console.error("JSON parse failed:", (e as Error).message);
      return new Response(
        JSON.stringify({ error: "Não foi possível processar a resposta da IA.", ads: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ads = Array.isArray(parsed.ads) ? parsed.ads : [];

    return new Response(JSON.stringify({ ads }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, ads: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
