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

    const apiKey =
      Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("GOOGLE_API_KEY");

    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY / GOOGLE_API_KEY");
      return new Response(
        JSON.stringify({ error: "Configuração de IA em falta. Contacta o suporte.", ads: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Gera exactamente 3 anúncios criativos em português de Portugal para o seguinte negócio.

Produto/Serviço: ${product}
${audience ? `Público-alvo: ${audience}` : ""}

Cada anúncio deve ter:
- headline: título curto e impactante (máx 30 caracteres)
- body: texto persuasivo do anúncio (máx 90 caracteres)
- cta: call-to-action (ex: "Saber Mais", "Comprar Agora")

Responde APENAS com JSON válido neste formato exacto, sem markdown nem texto extra:
{"ads":[{"headline":"...","body":"...","cta":"..."},{"headline":"...","body":"...","cta":"..."},{"headline":"...","body":"...","cta":"..."}]}`;

    // Try a list of models in order (newer first, then fallbacks)
    const models = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
    ];

    let text = "";
    let lastError = "";

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 1024,
              responseMimeType: "application/json",
            },
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          lastError = `Model ${model} HTTP ${res.status}: ${errBody.slice(0, 300)}`;
          console.error(lastError);
          continue;
        }

        const data = await res.json();
        text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text) {
          console.log(`Model ${model} succeeded`);
          break;
        }
        lastError = `Model ${model} returned empty content`;
      } catch (e) {
        lastError = `Model ${model} threw: ${(e as Error).message}`;
        console.error(lastError);
      }
    }

    if (!text) {
      return new Response(
        JSON.stringify({
          error: "A IA não respondeu. Tenta novamente em instantes.",
          ads: [],
          debug: lastError,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract JSON (handles cases where model wraps in ```json ... ```)
    const cleaned = text.replace(/```json|```/gi, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON in AI response:", text.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Formato de resposta inválido.", ads: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: { ads?: unknown };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("JSON parse failed:", (e as Error).message, text.slice(0, 500));
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
