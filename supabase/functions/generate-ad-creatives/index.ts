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
      return new Response(JSON.stringify({ error: "product is required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_API_KEY not set");

    const prompt = `Gera exactamente 3 anúncios criativos em português de Portugal para o seguinte negócio.

Produto/Serviço: ${product}
${audience ? `Público-alvo: ${audience}` : ""}

Cada anúncio deve ter:
- headline: título curto e impactante (máx 30 caracteres)
- body: texto persuasivo do anúncio (máx 90 caracteres)
- cta: call-to-action (ex: "Saber Mais", "Comprar Agora")

Responde APENAS com JSON válido neste formato:
{"ads": [{"headline": "...", "body": "...", "cta": "..."}, ...]}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
        }),
      }
    );

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message, ads: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
