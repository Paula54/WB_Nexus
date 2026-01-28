import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface MarketingStrategyInput {
  clientName: string;
  productService: string;
  audience: string;
  objective: string;
  plan: 'START' | 'PRO' | 'ELITE';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: MarketingStrategyInput = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const planDetails = {
      START: 'Site simples, 3 posts por semana, SEO básico',
      PRO: 'Site avançado, 5 posts por semana, Google Ads, SEO completo',
      ELITE: 'Site premium, posts diários, Google + Meta Ads, SEO + WhatsApp AI'
    };

    const systemPrompt = `És um especialista em marketing digital de elite. Gera estratégias completas e profissionais em Português de Portugal.

IMPORTANTE: Responde APENAS com JSON válido, sem markdown, sem código, apenas o objeto JSON.

A estrutura EXATA do JSON deve ser:
{
  "site": {
    "html": "HTML completo do site com Tailwind CSS classes",
    "seo_title": "Título SEO até 60 caracteres",
    "meta_description": "Meta descrição até 160 caracteres"
  },
  "ads": {
    "google": {
      "headlines": ["3 headlines até 30 chars cada"],
      "descriptions": ["2 descrições até 90 chars cada"],
      "keywords": ["10 keywords relevantes"]
    },
    "meta": {
      "primary_text": "Texto principal até 125 chars",
      "headline": "Headline até 40 chars"
    }
  },
  "social_media": [
    {
      "day": "Segunda",
      "theme": "Tema do post",
      "caption": "Legenda completa com emojis e hashtags",
      "image_prompt": "Prompt para gerar imagem"
    }
  ],
  "whatsapp_flow": [
    {
      "trigger": "palavra ou frase que ativa",
      "response": "resposta automática"
    }
  ],
  "integration_payload": {
    "hostinger_config": {
      "domain": "dominio-sugerido.pt",
      "template_id": "business-starter"
    },
    "google_ads_config": {
      "campaign_name": "Nome da campanha",
      "budget_daily": 10
    }
  }
}`;

    const userPrompt = `Cria uma estratégia de marketing completa para:

CLIENTE: ${input.clientName}
PRODUTO/SERVIÇO: ${input.productService}
PÚBLICO-ALVO: ${input.audience}
OBJETIVO: ${input.objective}
PLANO: ${input.plan} (${planDetails[input.plan]})

Requisitos específicos por plano:
- START: Site simples, 3 posts para a semana, SEO básico
- PRO: Site elaborado, 5 posts, Google Ads configurado
- ELITE: Site premium completo, 7 posts, Google + Meta Ads, 5 fluxos WhatsApp

O HTML do site deve usar Tailwind CSS e ser responsivo.
Gera conteúdo criativo, profissional e adaptado ao mercado português.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response, handling potential markdown code blocks
    let strategyResult;
    try {
      // Remove potential markdown code blocks
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      strategyResult = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse strategy response");
    }

    return new Response(JSON.stringify(strategyResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Strategy generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
