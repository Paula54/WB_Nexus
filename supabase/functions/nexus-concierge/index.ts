import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SECTOR_TEMPLATES: Record<string, { focus: string; keywords: string[]; tone: string }> = {
  cafetaria: {
    focus: "menu do dia, ambiente acolhedor, café de especialidade",
    keywords: ["café", "brunch", "pastelaria", "menu do dia", "esplanada"],
    tone: "acolhedor e familiar, usar emojis de comida ☕🥐",
  },
  imobiliaria: {
    focus: "venda e arrendamento de imóveis, visitas virtuais, investimento",
    keywords: ["apartamento", "moradia", "investimento", "localização premium", "visita virtual"],
    tone: "profissional e aspiracional, transmitir confiança e exclusividade",
  },
  advocacia: {
    focus: "consultoria jurídica, defesa de direitos, resolução de conflitos",
    keywords: ["direito", "consultoria", "proteção legal", "experiência", "resultados"],
    tone: "formal mas acessível, transmitir autoridade e confiança",
  },
  salao_beleza: {
    focus: "tratamentos de beleza, bem-estar, transformações",
    keywords: ["cabelo", "manicure", "spa", "tratamento", "beleza"],
    tone: "glamoroso e empoderador, usar emojis ✨💅",
  },
  restaurante: {
    focus: "gastronomia, experiência culinária, ingredientes frescos",
    keywords: ["chef", "menu", "degustação", "ingredientes frescos", "reserva"],
    tone: "sofisticado e apetitoso, descrever sabores e experiências",
  },
  fitness: {
    focus: "treino personalizado, saúde, superação pessoal",
    keywords: ["treino", "saúde", "resultados", "transformação", "personal trainer"],
    tone: "motivacional e energético, usar linguagem de superação 💪🔥",
  },
  loja_roupa: {
    focus: "moda, tendências, estilo pessoal, coleções",
    keywords: ["coleção", "tendência", "estilo", "look", "novidades"],
    tone: "trendy e inspirador, usar linguagem de lifestyle",
  },
  clinica: {
    focus: "saúde, bem-estar, cuidados médicos, prevenção",
    keywords: ["saúde", "consulta", "especialista", "tratamento", "prevenção"],
    tone: "profissional e empático, transmitir cuidado e competência",
  },
};

const SYSTEM_PROMPT = `Tu és o **Success Concierge** — o mentor estratégico interno da plataforma WB Nexus.

## 1. IDENTIDADE
- Chamas-te Success Concierge (nunca "bot", "assistente" ou "IA")
- Falas Português de Portugal (nunca brasileiro)
- És pragmático, direto e focado em resultados — o teu objetivo é ajudar o cliente a FATURAR
- Tens o tom de um consultor de negócios sénior: acolhedor, profissional, confiante
- Celebras vitórias e dás sempre o próximo passo concreto

## 2. CONHECIMENTO TÉCNICO DA PLATAFORMA
Conheces profundamente todas as funcionalidades da WB Nexus:

**Grupo OPERAÇÕES (sidebar):**
- **Centro de Comando** (Dashboard): Visão geral do negócio, KPIs, estado do trial
- **Site Builder**: Construtor visual de websites com páginas, secções (hero, features, testimonials, CTA, contacto) e publicação
- **Domínios**: Pesquisa e registo de domínios .pt/.com via integração Porkbun
- **Notas e Lembretes**: Sistema de produtividade pessoal integrado

**Grupo CRESCIMENTO:**
- **Gestão de Vendas** (CRM): Pipeline de potenciais clientes com classificação IA, notas, lembretes
- **Presença no Instagram** (Social Media): Criação, agendamento e publicação de posts (Instagram, Facebook, LinkedIn via Ayrshare)
- **Publicidade** (Ads): Campanhas Google Ads e Meta Ads com métricas integradas
- **Visibilidade no Google** (SEO): Auditoria técnica, análise de performance, sugestões de otimização
- **Email Marketing**: Newsletters com gestão de subscrições e campanhas
- **WhatsApp Inbox**: Comunicação com clientes via WhatsApp Business com respostas automáticas IA

**Grupo APOIO:**
- **Estratégia 360°**: Gerador de plano de marketing completo adaptado ao plano do cliente
- **Success Concierge** (tu!): Mentor IA com capacidade executiva

**Grupo CONTA:**
- **Definições**: Perfil de negócio, Google Ads, Meta Ads, biblioteca de assets, compliance RGPD
- **Subscrição**: Gestão do plano e pagamentos via Stripe
- **Perfil**: Dados pessoais, avatar, nome da empresa

**Integrações Ativas:**
- **Stripe**: Pagamentos e subscrições (testado e funcional — retorna 200 OK)
- **Google Ads**: Autenticação OAuth e gestão de campanhas
- **Meta/Facebook**: Ligação de contas de anúncios e Instagram Business
- **Google Analytics 4**: Tracking e métricas de performance
- **Ayrshare**: Publicação multi-plataforma de redes sociais
- **Twilio/Meta Cloud API**: WhatsApp Business

**Dados Críticos:**
- O NIF (Número de Identificação Fiscal) é obrigatório para faturação portuguesa — lembra sempre os clientes de o preencher no Perfil de Negócio
- Os domínios .pt exigem dados de empresa completos

## 3. MISSÃO DE APOIO
- Ajuda o utilizador a navegar nos 4 grupos da sidebar (Operações, Crescimento, Apoio, Conta)
- Responde a dúvidas sobre qualquer funcionalidade
- Executa tarefas diretamente quando solicitado (criar leads, agendar posts, definir lembretes)
- Diagnostica problemas e sugere soluções proativamente
- Guia o utilizador passo-a-passo em configurações complexas

## 4. ESTRATÉGIA DE UPSELL (aplicar com subtileza e utilidade)
Planos disponíveis:
- **Lite (49€/mês)**: Site Builder, CRM básico, Notas, 1 domínio
- **Business (89€/mês)**: Tudo do Lite + Automação de Anúncios (Google & Meta), SEO avançado, Email Marketing, WhatsApp Inbox, Estratégia 360°

Quando o cliente está no plano Lite e menciona funcionalidades do Business:
- NÃO bloqueies a conversa — explica o que a funcionalidade faz e como o ajudaria
- Sugere naturalmente: "Para isso, o plano Business (89€/mês) inclui automação de anúncios e SEO avançado — posso explicar como configurar?"
- Mostra o valor concreto: "Com o SEO avançado, negócios como o teu costumam aumentar 30-50% de tráfego orgânico nos primeiros 3 meses"
- Oferece sempre uma alternativa manual quando possível

## 5. REGRAS DE COMUNICAÇÃO
- Respostas concisas (máx 150 palavras) mas motivadoras
- Usa markdown e emojis relevantes
- Sê PROATIVO: sugere sempre o próximo passo concreto
- Usa linguagem orientada a resultados: "atrair mais clientes", "aumentar vendas", "crescer o negócio"
- Quando o utilizador pedir ações, USA AS FERRAMENTAS disponíveis
- Confirma ações executadas com entusiasmo
- INCLUI SEMPRE botões de ação usando: [ACTION:label:action_type:params]
  Exemplos:
  [ACTION:Gerar Post Agora:generate_draft:instagram]
  [ACTION:Agendar Lembrete:set_reminder:default]
  [ACTION:Criar Potencial Cliente:create_lead:default]
  [ACTION:Ver Presença Online:navigate:/social-media]
  [ACTION:Analisar Google:navigate:/seo]
  [ACTION:Ir para Subscrição:navigate:/subscription]

## 6. VOCABULÁRIO OBRIGATÓRIO
- "Leads" → "Potenciais Clientes"
- "SEO" → "Visibilidade no Google"
- "Social Media" → "Presença no Instagram"
- "CRM" → "Gestão de Vendas"
- "Settings" → "Definições"
- "Dashboard" → "Centro de Comando"
- "Site Builder" → "Construtor de Site"
- "Ads" → "Publicidade"
- "Strategy" → "Estratégia 360°"

Data atual: ${new Date().toISOString().split('T')[0]}`;

const tools = [
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Regista um novo potencial cliente na Gestão de Vendas",
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
  {
    type: "function",
    function: {
      name: "generate_instagram_draft",
      description: "Gera automaticamente rascunhos de posts de Instagram com legenda, hashtags e prompt de imagem, baseado no setor do negócio. Usa quando o utilizador quer criar conteúdo novo.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Tema ou tópico do post (ex: 'menu do dia', 'promoção de verão', 'novo imóvel')" },
          count: { type: "number", description: "Número de posts a gerar (1-5, default 1)" },
          platform: { type: "string", description: "Plataforma alvo: instagram, facebook, linkedin (default: instagram)" },
        },
        required: ["topic"],
      },
    },
  },
];

// Helper: Parse natural language dates
function parseNaturalDate(dateStr: string): string | null {
  const now = new Date();
  const lowerDate = dateStr.toLowerCase();

  if (lowerDate.includes("amanhã") || lowerDate.includes("amanha")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    const timeMatch = lowerDate.match(/(\d{1,2})[h:.]?(\d{2})?/);
    if (timeMatch) {
      d.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2] || "0"), 0);
    } else {
      d.setHours(9, 0, 0);
    }
    return d.toISOString();
  }

  if (lowerDate.includes("hoje")) {
    const d = new Date(now);
    const timeMatch = lowerDate.match(/(\d{1,2})[h:.]?(\d{2})?/);
    if (timeMatch) {
      d.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2] || "0"), 0);
    }
    return d.toISOString();
  }

  const dayMap: Record<string, number> = {
    domingo: 0, segunda: 1, "terça": 2, terca: 2, quarta: 3,
    quinta: 4, sexta: 5, "sábado": 6, sabado: 6,
  };

  for (const [dayName, dayNum] of Object.entries(dayMap)) {
    if (lowerDate.includes(dayName)) {
      const d = new Date(now);
      const currentDay = d.getDay();
      let daysToAdd = dayNum - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      d.setDate(d.getDate() + daysToAdd);
      const timeMatch = lowerDate.match(/(\d{1,2})[h:.]?(\d{2})?/);
      if (timeMatch) {
        d.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2] || "0"), 0);
      } else {
        d.setHours(10, 0, 0);
      }
      return d.toISOString();
    }
  }

  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch { /* ignore */ }

  return null;
}

// Tool handlers
// deno-lint-ignore no-explicit-any
async function handleCreateLead(supabase: any, userId: string, args: Record<string, unknown>) {
  const { name, email, phone, notes } = args as { name: string; email?: string; phone?: string; notes?: string };
  const { error } = await supabase.from("leads").insert({
    name, email: email || null, phone: phone || null, notes: notes || null,
    user_id: userId, status: "novo",
  });
  return error
    ? { success: false, message: `Erro ao criar lead: ${error.message}` }
    : { success: true, message: `Lead "${name}" criado com sucesso!` };
}

// deno-lint-ignore no-explicit-any
async function handleAddNoteToLead(supabase: any, userId: string, args: Record<string, unknown>) {
  const { lead_name, note } = args as { lead_name: string; note: string };
  const { data: leads } = await supabase
    .from("leads").select("id, notes").eq("user_id", userId)
    .ilike("name", `%${lead_name}%`).limit(1);

  if (leads && leads.length > 0) {
    const existingNotes = leads[0].notes || "";
    const newNotes = existingNotes
      ? `${existingNotes}\n\n[${new Date().toLocaleDateString("pt-PT")}] ${note}`
      : `[${new Date().toLocaleDateString("pt-PT")}] ${note}`;
    const { error } = await supabase.from("leads").update({ notes: newNotes }).eq("id", leads[0].id);
    return error
      ? { success: false, message: `Erro ao adicionar nota: ${error.message}` }
      : { success: true, message: `Nota adicionada ao lead "${lead_name}"` };
  }
  return { success: false, message: `Lead "${lead_name}" não encontrado` };
}

// deno-lint-ignore no-explicit-any
async function handleAddNote(supabase: any, userId: string, args: Record<string, unknown>) {
  const { content } = args as { content: string };
  const { error } = await supabase.from("notes_reminders").insert({
    user_id: userId, type: "note", content,
  });
  return error
    ? { success: false, message: `Erro ao guardar nota: ${error.message}` }
    : { success: true, message: `Nota guardada: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"` };
}

// deno-lint-ignore no-explicit-any
async function handleSetReminder(supabase: any, userId: string, args: Record<string, unknown>) {
  const { lead_name, task, due_date } = args as { lead_name?: string; task: string; due_date: string };
  const parsedDate = parseNaturalDate(due_date) || due_date;

  if (lead_name) {
    const { data: leads } = await supabase
      .from("leads").select("id, notes").eq("user_id", userId)
      .ilike("name", `%${lead_name}%`).limit(1);

    if (leads && leads.length > 0) {
      const existingNotes = leads[0].notes || "";
      const reminderNote = `\n\n[LEMBRETE ${new Date(parsedDate).toLocaleString("pt-PT")}] ${task}`;
      const { error } = await supabase
        .from("leads")
        .update({ reminder_date: parsedDate, notes: existingNotes + reminderNote })
        .eq("id", leads[0].id);
      return error
        ? { success: false, message: `Erro ao definir lembrete: ${error.message}` }
        : { success: true, message: `Lembrete definido para "${lead_name}" em ${new Date(parsedDate).toLocaleString("pt-PT")}` };
    }
    return { success: false, message: `Lead "${lead_name}" não encontrado` };
  }

  const { error } = await supabase.from("notes_reminders").insert({
    user_id: userId, type: "reminder", content: task, due_date: parsedDate,
  });
  return error
    ? { success: false, message: `Erro ao criar lembrete: ${error.message}` }
    : { success: true, message: `Lembrete criado para ${new Date(parsedDate).toLocaleString("pt-PT")}: "${task}"` };
}

// deno-lint-ignore no-explicit-any
async function handleSaveSiteProgress(supabase: any, userId: string, args: Record<string, unknown>) {
  const { project_name, sections } = args as { project_name: string; sections: string };
  const { data: existingProject } = await supabase
    .from("projects").select("id").eq("user_id", userId)
    .eq("name", project_name).limit(1).maybeSingle();

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
    return error
      ? { success: false, message: `Erro ao atualizar projeto: ${error.message}` }
      : { success: true, message: `Projeto "${project_name}" atualizado com sucesso!` };
  }

  const { error } = await supabase.from("projects").insert({
    user_id: userId, name: project_name, project_type: "website", content: sectionsData,
  });
  return error
    ? { success: false, message: `Erro ao criar projeto: ${error.message}` }
    : { success: true, message: `Projeto "${project_name}" criado e guardado!` };
}

// deno-lint-ignore no-explicit-any
async function handleSchedulePost(supabase: any, userId: string, args: Record<string, unknown>, supabaseUrl: string, serviceRoleKey: string) {
  const { post_search, platform, scheduled_date } = args as { post_search?: string; platform?: string; scheduled_date: string };
  const parsedDate = parseNaturalDate(scheduled_date);

  if (!parsedDate) {
    return { success: false, message: `Não consegui interpretar a data "${scheduled_date}". Tenta algo como "amanhã às 10h" ou "terça-feira às 14:00".` };
  }

  let query = supabase
    .from("social_posts").select("id, caption, platform, status")
    .eq("user_id", userId).in("status", ["draft", "failed"]);

  if (platform) query = query.ilike("platform", `%${platform}%`);

  const { data: posts } = await query.order("created_at", { ascending: false }).limit(10);

  if (!posts || posts.length === 0) {
    return { success: false, message: "Não encontrei nenhum post em rascunho para agendar." };
  }

  let targetPost = posts[0];
  if (post_search) {
    const matchedPost = posts.find(p => p.caption.toLowerCase().includes(post_search.toLowerCase()));
    if (matchedPost) targetPost = matchedPost;
  }

  const { error: updateError } = await supabase
    .from("social_posts").update({ scheduled_at: new Date(parsedDate).toISOString() }).eq("id", targetPost.id);

  if (updateError) {
    return { success: false, message: `Erro ao agendar: ${updateError.message}` };
  }

  const publishResponse = await fetch(`${supabaseUrl}/functions/v1/publish-social-post`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
    body: JSON.stringify({ postId: targetPost.id }),
  });
  const publishResult = await publishResponse.json();

  if (publishResult.success) {
    const dateStr = new Date(parsedDate).toLocaleDateString("pt-PT", {
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    });
    return {
      success: true,
      message: `⏰ Post agendado para ${dateStr}!\n\nPlataforma: ${targetPost.platform}\nLegenda: "${targetPost.caption.substring(0, 50)}${targetPost.caption.length > 50 ? '...' : ''}"`,
    };
  }
  return { success: false, message: `Erro ao agendar via Ayrshare: ${publishResult.error || "Erro desconhecido"}` };
}

// deno-lint-ignore no-explicit-any
async function handleGenerateInstagramDraft(
  supabase: any,
  userId: string,
  args: Record<string, unknown>,
  apiKey: string
) {
  const { topic, count = 1, platform = "instagram" } = args as { topic: string; count?: number; platform?: string };
  const postCount = Math.min(Math.max(1, count), 5);

  // Get user's business sector
  const { data: profile } = await supabase
    .from("profiles").select("business_sector, company_name")
    .eq("user_id", userId).maybeSingle();

  const sector = profile?.business_sector || "geral";
  const companyName = profile?.company_name || "o negócio";
  const sectorTemplate = SECTOR_TEMPLATES[sector];

  const sectorContext = sectorTemplate
    ? `O negócio é do setor ${sector}. Foco: ${sectorTemplate.focus}. Tom: ${sectorTemplate.tone}. Keywords relevantes: ${sectorTemplate.keywords.join(", ")}.`
    : `Adapta o conteúdo ao tema "${topic}" com um tom profissional e envolvente.`;

  const generatePrompt = `Gera ${postCount} post${postCount > 1 ? "s" : ""} de ${platform} para "${companyName}" sobre o tema "${topic}".

${sectorContext}

Para CADA post, retorna um objeto JSON com:
- caption: legenda envolvente com emojis (máx 200 caracteres)
- hashtags: array de 5-8 hashtags relevantes em português
- image_prompt: descrição em inglês para gerar uma imagem profissional

Retorna um array JSON com os posts. Apenas o JSON, sem markdown.`;

  try {
    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: "Gera conteúdo de redes sociais em Português de Portugal. Retorna APENAS JSON válido." },
          { role: "user", content: generatePrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      return { success: false, message: "Erro ao gerar conteúdo. Tenta novamente." };
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "[]";

    // Parse JSON from AI response (handle markdown code blocks)
    let cleanJson = rawContent.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }

    let posts: Array<{ caption: string; hashtags: string[]; image_prompt: string }>;
    try {
      const parsed = JSON.parse(cleanJson);
      posts = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return { success: false, message: "Erro ao processar a resposta da IA. Tenta novamente." };
    }

    // Save each post as a draft in social_posts
    const savedPosts: Array<{ id: string; caption: string; platform: string }> = [];
    for (const post of posts) {
      const { data, error } = await supabase.from("social_posts").insert({
        user_id: userId,
        platform: platform,
        caption: post.caption,
        hashtags: post.hashtags || [],
        status: "draft",
      }).select("id, caption, platform").single();

      if (!error && data) savedPosts.push(data);
    }

    if (savedPosts.length === 0) {
      return { success: false, message: "Erro ao guardar os rascunhos. Tenta novamente." };
    }

    const postSummary = savedPosts
      .map((p, i) => `**Post ${i + 1}:** "${p.caption.substring(0, 60)}${p.caption.length > 60 ? '...' : ''}"`)
      .join("\n");

    return {
      success: true,
      message: `✨ ${savedPosts.length} rascunho${savedPosts.length > 1 ? "s" : ""} criado${savedPosts.length > 1 ? "s" : ""}!\n\n${postSummary}\n\nVai à Presença no Instagram para publicar ou agendar!`,
    };
  } catch (error) {
    console.error("Draft generation error:", error);
    return { success: false, message: "Erro ao gerar o conteúdo. Tenta novamente." };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Authenticate user via JWT (decode payload directly - supports cross-project tokens)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    let user_id: string;
    try {
      // Decode JWT payload (base64url) without verification — verify_jwt is already false
      const payloadB64 = token.split(".")[1];
      const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
      const payload = JSON.parse(payloadJson);
      user_id = payload.sub;
      if (!user_id) throw new Error("No sub in token");
    } catch {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { messages, message, execute_tool, tool_name, tool_args } = body;

    // Support single message format
    let chatMessages: { role: string; content: string }[] = [];
    if (messages && Array.isArray(messages)) {
      chatMessages = messages;
    } else if (message) {
      chatMessages = [{ role: "user", content: message }];
    }

    // Handle tool execution
    if (execute_tool && tool_name) {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      let result = { success: false, message: "" };

      switch (tool_name) {
        case "create_lead":
          result = await handleCreateLead(supabase, user_id, tool_args);
          break;
        case "add_note_to_lead":
          result = await handleAddNoteToLead(supabase, user_id, tool_args);
          break;
        case "add_note":
          result = await handleAddNote(supabase, user_id, tool_args);
          break;
        case "set_reminder":
          result = await handleSetReminder(supabase, user_id, tool_args);
          break;
        case "save_site_progress":
          result = await handleSaveSiteProgress(supabase, user_id, tool_args);
          break;
        case "schedule_post":
          result = await handleSchedulePost(supabase, user_id, tool_args, SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
          break;
        case "generate_instagram_draft":
          result = await handleGenerateInstagramDraft(supabase, user_id, tool_args, GEMINI_API_KEY);
          break;
        default:
          result = { success: false, message: `Ferramenta "${tool_name}" não reconhecida` };
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enrich system prompt with user's business context
    let enrichedPrompt = SYSTEM_PROMPT;
    if (user_id) {
      try {
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
        const [profileRes, projectRes, subscriptionRes, leadsRes] = await Promise.all([
          supabase.from("profiles").select("business_sector, company_name, ai_custom_instructions, ai_credits_used, ai_credits_limit").eq("user_id", user_id).maybeSingle(),
          supabase.from("projects").select("name, domain, selected_plan, trial_expires_at").eq("user_id", user_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("subscriptions").select("plan_type, status, trial_ends_at").eq("user_id", user_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("leads").select("id").eq("user_id", user_id),
        ]);

        const profile = profileRes.data;
        const project = projectRes.data;
        const subscription = subscriptionRes.data;
        const leadsCount = leadsRes.data?.length || 0;

        // Determine current plan
        const planType = subscription?.plan_type || project?.selected_plan || "Lite";
        const isLitePlan = planType?.toLowerCase().includes("lite") || planType?.toLowerCase().includes("start");

        enrichedPrompt += `\n\nCONTEXTO DO UTILIZADOR:
- Empresa: ${profile?.company_name || "Não definido"}
- Setor: ${profile?.business_sector || "Não definido"}
- Plano atual: ${planType}${isLitePlan ? " (Lite — 49€/mês)" : " (Business — 89€/mês)"}
- Estado da subscrição: ${subscription?.status || "trial"}
- Projeto: ${project?.name || "Sem projeto"}
- Domínio: ${project?.domain || "Não configurado"}
- Potenciais clientes: ${leadsCount}
- Créditos IA: ${profile?.ai_credits_used || 0}/${profile?.ai_credits_limit || 50000}`;

        if (profile?.ai_custom_instructions) {
          enrichedPrompt += `\n- Instruções personalizadas do utilizador: ${profile.ai_custom_instructions}`;
        }

        if (profile?.business_sector && SECTOR_TEMPLATES[profile.business_sector]) {
          const tmpl = SECTOR_TEMPLATES[profile.business_sector];
          enrichedPrompt += `\n\nESPECIALIZAÇÃO DO SETOR (${profile.business_sector}):
- Foco de conteúdo: ${tmpl.focus}
- Tom de comunicação: ${tmpl.tone}
- Keywords prioritárias: ${tmpl.keywords.join(", ")}
Adapta TODAS as sugestões e conteúdos a este setor específico.`;
        }

        if (isLitePlan) {
          enrichedPrompt += `\n\nNOTA INTERNA: Este cliente está no plano Lite. Quando mencionar funcionalidades de Publicidade, SEO avançado, Email Marketing ou WhatsApp, explica o valor e sugere naturalmente o upgrade para Business (89€/mês). Nunca bloqueies — oferece sempre alternativas manuais.`;
        }

        // Trial info
        if (project?.trial_expires_at) {
          const trialEnd = new Date(project.trial_expires_at);
          const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
          if (daysLeft > 0) {
            enrichedPrompt += `\n- Trial ativo: ${daysLeft} dias restantes`;
          } else {
            enrichedPrompt += `\n- Trial EXPIRADO — sugere ativação do plano`;
          }
        }
      } catch (e) {
        console.error("Error enriching context:", e);
      }
    }

    // Regular chat with tool calling
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: enrichedPrompt },
            ...chatMessages,
          ],
          tools,
          stream: chatMessages.length > 1,
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

    // For single-message requests, return JSON
    if (chatMessages.length === 1) {
      const result = await response.json();
      const aiResponse = result.choices?.[0]?.message?.content || "";
      return new Response(
        JSON.stringify({ response: aiResponse }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For multi-turn conversations, stream
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
