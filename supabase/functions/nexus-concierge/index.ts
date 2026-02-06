import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

As tuas capacidades EXECUTIVAS:
- Criar novos leads no CRM
- Adicionar notas a leads existentes
- Definir lembretes de acompanhamento
- Agendar publicações nas redes sociais
- Aconselhar sobre estratégias de marketing e vendas

Regras:
- Mantém respostas concisas mas informativas (máximo 150 palavras)
- Usa formatação markdown quando apropriado
- Sê proativo em sugerir próximos passos
- Quando o utilizador pedir para criar um lead, adicionar nota, lembrete ou agendar post, USA AS FERRAMENTAS disponíveis
- Confirma sempre as ações executadas

Exemplos de comandos que deves executar:
- "Cria um lead chamado João Silva com email joao@email.com"
- "Adiciona uma nota ao lead X: Interessado em T3"
- "Define lembrete para amanhã às 10h para ligar ao cliente Y"
- "Agenda o post sobre o plano Elite para terça-feira às 10:00"
- "Publica aquele post do Instagram para amanhã às 14h"

Data atual: ${new Date().toISOString().split('T')[0]}`;

const tools = [
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Cria um novo lead/contacto no CRM",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome completo do lead" },
          email: { type: "string", description: "Email do lead (opcional)" },
          phone: { type: "string", description: "Telefone do lead (opcional)" },
          notes: { type: "string", description: "Notas iniciais sobre o lead (opcional)" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_note_to_lead",
      description: "Adiciona uma nota a um lead existente",
      parameters: {
        type: "object",
        properties: {
          lead_name: { type: "string", description: "Nome do lead para identificação" },
          note: { type: "string", description: "Conteúdo da nota a adicionar" },
        },
        required: ["lead_name", "note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_note",
      description: "Guarda uma nota rápida geral (não associada a um lead específico)",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Conteúdo da nota" },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_reminder",
      description: "Define um lembrete de acompanhamento para um lead ou tarefa geral",
      parameters: {
        type: "object",
        properties: {
          lead_name: { type: "string", description: "Nome do lead (opcional - se não fornecido, cria lembrete geral)" },
          task: { type: "string", description: "Descrição da tarefa ou lembrete" },
          due_date: { type: "string", description: "Data e hora do lembrete em formato ISO (YYYY-MM-DDTHH:mm) ou linguagem natural" },
        },
        required: ["task", "due_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_site_progress",
      description: "Guarda o progresso atual do SiteBuilder no projeto do utilizador",
      parameters: {
        type: "object",
        properties: {
          project_name: { type: "string", description: "Nome do projeto" },
          sections: { type: "string", description: "JSON com as secções do site a guardar" },
        },
        required: ["project_name", "sections"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_post",
      description: "Agenda um post de redes sociais para uma data e hora específica",
      parameters: {
        type: "object",
        properties: {
          post_search: { type: "string", description: "Texto para identificar o post (parte da legenda, nome da plataforma, etc.)" },
          platform: { type: "string", description: "Plataforma: instagram, facebook, linkedin" },
          scheduled_date: { type: "string", description: "Data e hora para agendar (ex: 'amanhã às 10h', 'terça-feira às 14:00', '2024-01-15T10:00')" },
        },
        required: ["scheduled_date"],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { messages, message, context, execute_tool, tool_name, tool_args, user_id } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Support single message format (for simple requests like ad generation)
    let chatMessages: { role: string; content: string }[] = [];
    if (messages && Array.isArray(messages)) {
      chatMessages = messages;
    } else if (message) {
      chatMessages = [{ role: "user", content: message }];
    }

    // Handle tool execution
    if (execute_tool && tool_name && user_id) {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      let result = { success: false, message: "" };

      if (tool_name === "create_lead") {
        const { name, email, phone, notes } = tool_args;
        const { error } = await supabase.from("leads").insert({
          name,
          email: email || null,
          phone: phone || null,
          notes: notes || null,
          user_id,
          status: "novo",
        });
        result = error
          ? { success: false, message: `Erro ao criar lead: ${error.message}` }
          : { success: true, message: `Lead "${name}" criado com sucesso!` };
      } else if (tool_name === "add_note_to_lead") {
        const { lead_name, note } = tool_args;
        const { data: leads } = await supabase
          .from("leads")
          .select("id, notes")
          .eq("user_id", user_id)
          .ilike("name", `%${lead_name}%`)
          .limit(1);

        if (leads && leads.length > 0) {
          const existingNotes = leads[0].notes || "";
          const newNotes = existingNotes ? `${existingNotes}\n\n[${new Date().toLocaleDateString("pt-PT")}] ${note}` : `[${new Date().toLocaleDateString("pt-PT")}] ${note}`;
          const { error } = await supabase
            .from("leads")
            .update({ notes: newNotes })
            .eq("id", leads[0].id);
          result = error
            ? { success: false, message: `Erro ao adicionar nota: ${error.message}` }
            : { success: true, message: `Nota adicionada ao lead "${lead_name}"` };
        } else {
          result = { success: false, message: `Lead "${lead_name}" não encontrado` };
        }
      } else if (tool_name === "add_note") {
        // General note not tied to a lead
        const { content } = tool_args;
        const { error } = await supabase.from("notes_reminders").insert({
          user_id,
          type: "note",
          content,
        });
        result = error
          ? { success: false, message: `Erro ao guardar nota: ${error.message}` }
          : { success: true, message: `Nota guardada: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"` };
      } else if (tool_name === "set_reminder") {
        const { lead_name, task, due_date } = tool_args;
        
        // Parse due_date - try to handle natural language dates
        let parsedDate = due_date;
        const now = new Date();
        const lowerDate = due_date.toLowerCase();
        
        if (lowerDate.includes("amanhã") || lowerDate.includes("amanha")) {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const timeMatch = lowerDate.match(/(\d{1,2})[h:.]?(\d{2})?/);
          if (timeMatch) {
            tomorrow.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2] || "0"), 0);
          } else {
            tomorrow.setHours(9, 0, 0);
          }
          parsedDate = tomorrow.toISOString();
        } else if (lowerDate.includes("hoje")) {
          const today = new Date(now);
          const timeMatch = lowerDate.match(/(\d{1,2})[h:.]?(\d{2})?/);
          if (timeMatch) {
            today.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2] || "0"), 0);
          }
          parsedDate = today.toISOString();
        }

        if (lead_name) {
          // Reminder tied to a lead
          const { data: leads } = await supabase
            .from("leads")
            .select("id, notes")
            .eq("user_id", user_id)
            .ilike("name", `%${lead_name}%`)
            .limit(1);

          if (leads && leads.length > 0) {
            const existingNotes = leads[0].notes || "";
            const reminderNote = `\n\n[LEMBRETE ${new Date(parsedDate).toLocaleString("pt-PT")}] ${task}`;
            const { error } = await supabase
              .from("leads")
              .update({
                reminder_date: parsedDate,
                notes: existingNotes + reminderNote,
              })
              .eq("id", leads[0].id);
            result = error
              ? { success: false, message: `Erro ao definir lembrete: ${error.message}` }
              : { success: true, message: `Lembrete definido para "${lead_name}" em ${new Date(parsedDate).toLocaleString("pt-PT")}` };
          } else {
            result = { success: false, message: `Lead "${lead_name}" não encontrado` };
          }
        } else {
          // General reminder not tied to a lead
          const { error } = await supabase.from("notes_reminders").insert({
            user_id,
            type: "reminder",
            content: task,
            due_date: parsedDate,
          });
          result = error
            ? { success: false, message: `Erro ao criar lembrete: ${error.message}` }
            : { success: true, message: `Lembrete criado para ${new Date(parsedDate).toLocaleString("pt-PT")}: "${task}"` };
        }
      } else if (tool_name === "save_site_progress") {
        const { project_name, sections } = tool_args;
        
        // Check if project exists
        const { data: existingProject } = await supabase
          .from("projects")
          .select("id")
          .eq("user_id", user_id)
          .eq("name", project_name)
          .limit(1)
          .maybeSingle();

        let sectionsData;
        try {
          sectionsData = typeof sections === "string" ? JSON.parse(sections) : sections;
        } catch {
          sectionsData = { raw: sections };
        }

        if (existingProject) {
          const { error } = await supabase
            .from("projects")
            .update({ content: sectionsData, updated_at: new Date().toISOString() })
            .eq("id", existingProject.id);
          result = error
            ? { success: false, message: `Erro ao atualizar projeto: ${error.message}` }
            : { success: true, message: `Projeto "${project_name}" atualizado com sucesso!` };
        } else {
          const { error } = await supabase.from("projects").insert({
            user_id,
            name: project_name,
            project_type: "website",
            content: sectionsData,
          });
          result = error
            ? { success: false, message: `Erro ao criar projeto: ${error.message}` }
            : { success: true, message: `Projeto "${project_name}" criado e guardado!` };
        }
      } else if (tool_name === "schedule_post") {
        const { post_search, platform, scheduled_date } = tool_args;
        
        // Parse the scheduled date
        const now = new Date();
        let parsedDate: Date | null = null;
        const lowerDate = scheduled_date.toLowerCase();
        
        // Parse natural language dates
        if (lowerDate.includes("amanhã") || lowerDate.includes("amanha")) {
          parsedDate = new Date(now);
          parsedDate.setDate(parsedDate.getDate() + 1);
          const timeMatch = lowerDate.match(/(\d{1,2})[h:.]?(\d{2})?/);
          if (timeMatch) {
            parsedDate.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2] || "0"), 0);
          } else {
            parsedDate.setHours(10, 0, 0);
          }
        } else if (lowerDate.includes("hoje")) {
          parsedDate = new Date(now);
          const timeMatch = lowerDate.match(/(\d{1,2})[h:.]?(\d{2})?/);
          if (timeMatch) {
            parsedDate.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2] || "0"), 0);
          }
        } else if (lowerDate.includes("segunda") || lowerDate.includes("terça") || lowerDate.includes("terca") || 
                   lowerDate.includes("quarta") || lowerDate.includes("quinta") || lowerDate.includes("sexta") ||
                   lowerDate.includes("sábado") || lowerDate.includes("sabado") || lowerDate.includes("domingo")) {
          // Day of week parsing
          const dayMap: Record<string, number> = {
            "domingo": 0, "segunda": 1, "terça": 2, "terca": 2, "quarta": 3,
            "quinta": 4, "sexta": 5, "sábado": 6, "sabado": 6
          };
          
          for (const [dayName, dayNum] of Object.entries(dayMap)) {
            if (lowerDate.includes(dayName)) {
              parsedDate = new Date(now);
              const currentDay = parsedDate.getDay();
              let daysToAdd = dayNum - currentDay;
              if (daysToAdd <= 0) daysToAdd += 7;
              parsedDate.setDate(parsedDate.getDate() + daysToAdd);
              break;
            }
          }
          
          if (parsedDate) {
            const timeMatch = lowerDate.match(/(\d{1,2})[h:.]?(\d{2})?/);
            if (timeMatch) {
              parsedDate.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2] || "0"), 0);
            } else {
              parsedDate.setHours(10, 0, 0);
            }
          }
        } else {
          // Try to parse as ISO date
          try {
            parsedDate = new Date(scheduled_date);
            if (isNaN(parsedDate.getTime())) {
              parsedDate = null;
            }
          } catch {
            parsedDate = null;
          }
        }

        if (!parsedDate) {
          result = { success: false, message: `Não consegui interpretar a data "${scheduled_date}". Tenta algo como "amanhã às 10h" ou "terça-feira às 14:00".` };
        } else {
          // Find posts that match the search criteria
          let query = supabase
            .from("social_posts")
            .select("id, caption, platform, status")
            .eq("user_id", user_id)
            .in("status", ["draft", "failed"]);

          if (platform) {
            query = query.ilike("platform", `%${platform}%`);
          }

          const { data: posts } = await query.order("created_at", { ascending: false }).limit(10);

          if (!posts || posts.length === 0) {
            result = { success: false, message: "Não encontrei nenhum post em rascunho para agendar." };
          } else {
            // Find the best matching post
            let targetPost = posts[0];
            if (post_search) {
              const matchedPost = posts.find(p => 
                p.caption.toLowerCase().includes(post_search.toLowerCase())
              );
              if (matchedPost) {
                targetPost = matchedPost;
              }
            }

            // Update the post with the scheduled date and trigger publish
            const { error: updateError } = await supabase
              .from("social_posts")
              .update({ scheduled_at: parsedDate.toISOString() })
              .eq("id", targetPost.id);

            if (updateError) {
              result = { success: false, message: `Erro ao agendar: ${updateError.message}` };
            } else {
              // Call the publish edge function to schedule via Ayrshare
              const publishResponse = await fetch(`${SUPABASE_URL}/functions/v1/publish-social-post`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({ postId: targetPost.id }),
              });

              const publishResult = await publishResponse.json();

              if (publishResult.success) {
                const dateStr = parsedDate.toLocaleDateString("pt-PT", { 
                  weekday: "long", 
                  day: "numeric", 
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit"
                });
                result = { 
                  success: true, 
                  message: `⏰ Post agendado para ${dateStr}!\n\nPlataforma: ${targetPost.platform}\nLegenda: "${targetPost.caption.substring(0, 50)}${targetPost.caption.length > 50 ? '...' : ''}"` 
                };
              } else {
                result = { success: false, message: `Erro ao agendar via Ayrshare: ${publishResult.error || "Erro desconhecido"}` };
              }
            }
          }
        }
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Regular chat with tool calling
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
            ...chatMessages,
          ],
          tools,
          stream: chatMessages.length > 1, // Only stream for multi-turn conversations
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

    // For single-message requests (like ad generation), return JSON response
    if (chatMessages.length === 1) {
      const result = await response.json();
      const aiResponse = result.choices?.[0]?.message?.content || "";
      return new Response(
        JSON.stringify({ response: aiResponse }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For multi-turn conversations, stream the response
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