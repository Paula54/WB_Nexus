import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
- **Stripe**: Pagamentos e subscrições
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
- **REGRA CRÍTICA DE NAVEGAÇÃO**: NÃO incluas botões [ACTION:...:navigate:...] a menos que o utilizador peça EXPLICITAMENTE para ir a outra página (ex: "leva-me ao inbox", "abre o CRM"). Em vez disso, explica como fazer as coisas DENTRO do chat.
- INCLUI botões de ação executáveis (não de navegação):
  [ACTION:Gerar Post Agora:generate_draft:instagram]
  [ACTION:Agendar Lembrete:set_reminder:default]
  [ACTION:Criar Potencial Cliente:create_lead:default]
- Botões de navegação SÓ quando o utilizador pedir explicitamente:
  [ACTION:Ver Presença Online:navigate:/social-media]
  [ACTION:Analisar Google:navigate:/seo]

## 6. SAUDAÇÃO INTELIGENTE (PLAN-AWARE & DNA-AWARE)
- Se o utilizador tiver DNA configurado (nome da empresa + setor), saúda assim:
  "Olá [primeiro nome]! Já vi que a [Nome da Empresa] atua no setor de [Setor]. Incrível! 🎯"
- Se NÃO tiver DNA, pede para o configurar primeiro no Perfil (DNA do Negócio).
- Após a saudação, sugere o PRÓXIMO PASSO DE ALTO IMPACTO baseado no plano:
  - **Plano Premium (Growth/OS/Business)**: sugere configurar **WhatsApp Business** ou lançar a **primeira campanha de Publicidade** (Google/Meta).
  - **Plano Básico (Start/Lite)**: sugere focar no **Site Builder** ou na **Presença no Instagram**.

## 7. REFORÇO EDUCATIVO (MEMÓRIA ATIVA)
Em momentos oportunos (após gerar conteúdo, ao discutir anúncios ou SEO), reforça subtilmente:
> "Lembra-te: quanto mais detalhada for a descrição no teu Perfil, mais certeiros e profissionais serão os anúncios e posts que a minha IA vai gerar para ti automaticamente."
Não repitas em mensagens consecutivas. Usa no máximo 1x a cada 3-4 interações.

## 8. SUGESTÕES CONTEXTUAIS POR SETOR
Quando o utilizador estiver a criar conteúdo de redes sociais, anúncios ou SEO, ADAPTA SEMPRE as sugestões às keywords e tom do setor do utilizador (ver bloco ESPECIALIZAÇÃO DO SETOR mais abaixo).

## 9. VOCABULÁRIO OBRIGATÓRIO
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
          lead_name: { type: "string", description: "Nome do lead (opcional)" },
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
      name: "generate_instagram_draft",
      description: "Gera automaticamente rascunhos de posts de Instagram com legenda, hashtags e prompt de imagem",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Tema ou tópico do post" },
          count: { type: "number", description: "Número de posts a gerar (1-5, default 1)" },
          platform: { type: "string", description: "Plataforma alvo: instagram, facebook, linkedin (default: instagram)" },
        },
        required: ["topic"],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { messages, user_context } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Input validation: length limit
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.content && typeof lastMessage.content === "string" && lastMessage.content.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Mensagem demasiado longa. Máximo: 2000 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Input validation: prompt injection pattern detection
    const INJECTION_PATTERNS = [
      /ignore\s+(all\s+)?previous\s+instructions/i,
      /ignore\s+above/i,
      /system\s*:/i,
      /\[INST\]/i,
      /<\|im_start\|>/i,
      /you\s+are\s+now\s+/i,
      /new\s+instructions?\s*:/i,
      /override\s+system/i,
    ];

    const userContent = lastMessage?.content || "";
    if (typeof userContent === "string" && INJECTION_PATTERNS.some(p => p.test(userContent))) {
      return new Response(
        JSON.stringify({ error: "Mensagem contém padrões não permitidos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build enriched prompt with context sent from frontend
    let enrichedPrompt = SYSTEM_PROMPT;

    if (user_context) {
      const ctx = user_context;
      const planUpper = (ctx.plan_type || "").toUpperCase();
      const isLitePlan = !ctx.is_premium_plan && (planUpper.includes("LITE") || planUpper.includes("START") || !ctx.is_premium_plan);
      const firstName = (ctx.full_name || "").split(" ")[0];

      enrichedPrompt += `\n\nCONTEXTO DO UTILIZADOR:
- Nome: ${ctx.full_name || "Não definido"}${firstName ? ` (primeiro nome: ${firstName})` : ""}
- Empresa: ${ctx.company_name || "Não definido"}
- Setor: ${ctx.business_sector || "Não definido"}
- Descrição do negócio: ${ctx.business_description || "Não definido"}
- Plano atual: ${ctx.plan_type || "Lite"} ${ctx.is_premium_plan ? "(PREMIUM — WhatsApp + Ads disponíveis)" : "(BÁSICO — focar em Site e Instagram)"}
- DNA configurado: ${ctx.has_dna ? "SIM ✅" : "NÃO ❌ (pede para configurar primeiro no Perfil!)"}
- Projeto: ${ctx.project_name || "Sem projeto"}
- Domínio: ${ctx.domain || "Não configurado"}
- Potenciais clientes: ${ctx.leads_count || 0}`;

      if (ctx.ai_custom_instructions) {
        enrichedPrompt += `\n- Instruções personalizadas: ${ctx.ai_custom_instructions}`;
      }

      if (ctx.business_sector && SECTOR_TEMPLATES[ctx.business_sector]) {
        const tmpl = SECTOR_TEMPLATES[ctx.business_sector];
        enrichedPrompt += `\n\nESPECIALIZAÇÃO DO SETOR (${ctx.business_sector}):
- Foco de conteúdo: ${tmpl.focus}
- Tom de comunicação: ${tmpl.tone}
- Keywords prioritárias: ${tmpl.keywords.join(", ")}
Adapta TODAS as sugestões e conteúdos a este setor específico.`;
      }

      if (isLitePlan) {
        enrichedPrompt += `\n\nNOTA INTERNA: Este cliente está no plano Lite. Quando mencionar funcionalidades de Publicidade, SEO avançado, Email Marketing ou WhatsApp, explica o valor e sugere naturalmente o upgrade para Business (89€/mês). Nunca bloqueies — oferece sempre alternativas manuais.`;
      }

      if (ctx.trial_days_left !== undefined) {
        if (ctx.trial_days_left > 0) {
          enrichedPrompt += `\n- Trial ativo: ${ctx.trial_days_left} dias restantes`;
        } else {
          enrichedPrompt += `\n- Trial EXPIRADO — sugere ativação do plano`;
        }
      }
    }

    // Call Gemini API
    const shouldStream = messages.length > 1;

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
            { role: "system", content: enrichedPrompt },
            ...messages,
          ],
          tools,
          stream: shouldStream,
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Gemini API error:", status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!shouldStream) {
      const result = await response.json();
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream response
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("[nexus-concierge] internal error:", error);
    return new Response(
      JSON.stringify({ error: "Ocorreu um erro interno no Concierge." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
