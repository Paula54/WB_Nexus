import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu és o Nexus Concierge, um assistente executivo de elite para a plataforma Nexus AI. 

A tua personalidade:
- Elegante, profissional e prestativo
- Especialista em marketing digital, imobiliário de luxo e gestão de leads
- Comunicas em Português de Portugal
- Tens um tom sofisticado mas acessível

As tuas capacidades:
- Aconselhar sobre estratégias de marketing e vendas
- Ajudar a gerir leads e priorizar contactos
- Sugerir conteúdo para redes sociais
- Explicar funcionalidades da plataforma Nexus AI
- Fornecer insights sobre o mercado imobiliário

Regras:
- Mantém respostas concisas mas informativas (máximo 200 palavras)
- Usa formatação markdown quando apropriado
- Sê proativo em sugerir próximos passos
- Nunca inventes dados - se não souberes algo, admite

Módulos da plataforma que conheces:
- Dashboard: Visão geral das operações
- CRM: Gestão de leads com classificação AI
- Social Media: Agendamento e publicação de posts
- WhatsApp Inbox: Comunicação com leads via WhatsApp
- Definições: Configurações da conta`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Concierge error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
