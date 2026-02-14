import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VERIFY_TOKEN = "nexus_whatsapp_verify_2024";

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ========== WEBHOOK VERIFICATION (GET) ==========
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log("Webhook verification request:", { mode, token, challenge });

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified successfully!");
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  // ========== INCOMING MESSAGES (POST) ==========
  try {
    const body = await req.json();
    console.log("Incoming webhook payload:", JSON.stringify(body).substring(0, 500));

    // Meta sends a verification object on subscribe
    if (body.object !== "whatsapp_business_account") {
      return new Response("OK", { status: 200 });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (const message of messages) {
          if (message.type !== "text") {
            console.log(`Skipping non-text message type: ${message.type}`);
            continue;
          }

          const from = message.from; // sender phone number
          const text = message.text?.body || "";
          const contactName = contacts.find((c: any) => c.wa_id === from)?.profile?.name || "Desconhecido";

          console.log(`Message from ${contactName} (${from}): ${text}`);

          // Find which user owns this WhatsApp number via whatsapp_accounts
          // For now, look up the WABA phone number to find the owner
          const { data: waAccount } = await supabase
            .from("whatsapp_accounts")
            .select("user_id")
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

          if (!waAccount) {
            console.error("No active WhatsApp account found");
            continue;
          }

          const userId = waAccount.user_id;

          // Check usage limits
          const { data: profile } = await supabase
            .from("profiles")
            .select("whatsapp_usage_count, contact_email, ai_custom_instructions, company_name, business_sector")
            .eq("user_id", userId)
            .maybeSingle();

          const usageCount = profile?.whatsapp_usage_count || 0;

          if (usageCount >= 200) {
            // Containment mode - redirect to email
            const contactEmail = profile?.contact_email || "";
            const replyText = contactEmail
              ? `Obrigado pela sua mensagem! De momento, por favor contacte-nos via email: ${contactEmail}`
              : "Obrigado pela sua mensagem! Entraremos em contacto brevemente.";

            await sendWhatsAppMessage(WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, from, replyText);
            continue;
          }

          // Increment usage
          await supabase
            .from("profiles")
            .update({ whatsapp_usage_count: usageCount + 1 })
            .eq("user_id", userId);

          // Find or create lead
          const formattedPhone = "+" + from;
          const { data: existingLead } = await supabase
            .from("leads")
            .select("id")
            .eq("user_id", userId)
            .eq("phone", formattedPhone)
            .maybeSingle();

          let leadId: string;

          if (existingLead) {
            leadId = existingLead.id;
          } else {
            const { data: newLead, error: leadError } = await supabase
              .from("leads")
              .insert({
                user_id: userId,
                name: contactName,
                phone: formattedPhone,
                source: "whatsapp",
                status: "novo",
                whatsapp_message: text,
              })
              .select("id")
              .single();

            if (leadError || !newLead) {
              console.error("Error creating lead:", leadError);
              continue;
            }
            leadId = newLead.id;
          }

          // Save incoming message
          await supabase.from("conversation_messages").insert({
            lead_id: leadId,
            sender_type: "contact",
            message_text: text,
          });

          // Generate AI response
          let aiReply = "Obrigado pela sua mensagem! Entraremos em contacto brevemente.";

          if (LOVABLE_API_KEY) {
            try {
              const customInstructions = profile?.ai_custom_instructions || "";
              const companyName = profile?.company_name || "";
              const sector = profile?.business_sector || "";

              const aiPrompt = `Tu és um assistente profissional de atendimento via WhatsApp para a empresa "${companyName}" (setor: ${sector}).
${customInstructions ? `Instruções personalizadas: ${customInstructions}` : ""}

Regras:
- Responde em Português de Portugal
- Máximo 300 caracteres
- Tom elegante e profissional
- Classifica o contacto: responde com JSON { "classification": "hot" ou "cold", "reply": "a tua resposta" }
- "hot" = cliente interessado em comprar/contratar
- "cold" = curiosidade geral ou spam

Mensagem recebida de ${contactName}: "${text}"`;

              const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [{ role: "user", content: aiPrompt }],
                }),
              });

              if (aiResponse.ok) {
                const aiResult = await aiResponse.json();
                const content = aiResult.choices?.[0]?.message?.content || "";

                // Try to parse JSON response
                let cleanContent = content.trim();
                if (cleanContent.startsWith("```")) {
                  cleanContent = cleanContent.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
                }

                try {
                  const parsed = JSON.parse(cleanContent);
                  aiReply = parsed.reply || aiReply;

                  // Update lead classification
                  if (parsed.classification) {
                    await supabase
                      .from("leads")
                      .update({ ai_classification: parsed.classification })
                      .eq("id", leadId);
                  }
                } catch {
                  // If not JSON, use raw content
                  if (content.length > 0 && content.length <= 500) {
                    aiReply = content;
                  }
                }
              }
            } catch (e) {
              console.error("AI response error:", e);
            }
          }

          // Send auto-reply via WhatsApp
          await sendWhatsAppMessage(WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, from, aiReply);

          // Save auto-reply to conversation
          await supabase.from("conversation_messages").insert({
            lead_id: leadId,
            sender_type: "auto",
            message_text: `[AUTO] ${aiReply}`,
          });

          console.log(`Auto-reply sent to ${from}: ${aiReply.substring(0, 50)}...`);
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("OK", { status: 200 }); // Always 200 for Meta
  }
});

async function sendWhatsAppMessage(token: string, phoneNumberId: string, to: string, text: string) {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );

  const result = await response.json();
  if (!response.ok || result.error) {
    console.error("WhatsApp send error:", JSON.stringify(result));
  }
  return result;
}
