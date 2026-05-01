import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SeedSection {
  type: string;
  content: Record<string, unknown>;
}

interface SeedTemplate {
  sector: string;
  name: string;
  description: string;
  sections: SeedSection[];
}

// Imagens de placeholder Unsplash de alta qualidade por setor (substituídas por IA quando o utilizador aplica)
const HERO_IMAGES: Record<string, string> = {
  clinica: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1920&q=80",
  restaurante: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&q=80",
  cafetaria: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1920&q=80",
  advocacia: "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=1920&q=80",
  imobiliaria: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1920&q=80",
  salao_beleza: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1920&q=80",
  fitness: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80",
  loja_roupa: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&q=80",
};

const TEMPLATES: SeedTemplate[] = [
  // ============== CLÍNICA ==============
  {
    sector: "clinica",
    name: "Clínica Confiança",
    description: "Layout institucional para clínicas e consultórios — foco em credibilidade.",
    sections: [
      { type: "hero", content: { title: "Cuidados de Saúde de Excelência", subtitle: "Equipa multidisciplinar dedicada ao seu bem-estar há mais de uma década.", buttonText: "Marcar Consulta", backgroundImage: HERO_IMAGES.clinica } },
      { type: "features", content: { title: "Especialidades", items: [
        { title: "Medicina Geral", desc: "Acompanhamento contínuo e preventivo." },
        { title: "Pediatria", desc: "Cuidado especializado para os mais novos." },
        { title: "Análises Clínicas", desc: "Resultados rápidos e fiáveis." },
        { title: "Cardiologia", desc: "Diagnóstico avançado para o seu coração." },
        { title: "Ginecologia", desc: "Saúde da mulher em todas as fases." },
        { title: "Fisioterapia", desc: "Recuperação funcional personalizada." },
      ] } },
      { type: "testimonials", content: { title: "Pacientes Satisfeitos", items: [
        { title: "Maria S.", desc: "Atendimento humano e profissional. Recomendo a todos." },
        { title: "João P.", desc: "Diagnóstico rápido e equipa muito atenciosa." },
      ] } },
      { type: "cta", content: { title: "A sua saúde é prioridade", subtitle: "Atendimento de segunda a sábado, com marcação prévia.", buttonText: "Marcar agora" } },
      { type: "contact", content: { title: "Fale Connosco", buttonText: "Enviar Mensagem" } },
    ],
  },
  {
    sector: "clinica",
    name: "Clínica Premium",
    description: "Modelo elegante para clínicas privadas de alto padrão.",
    sections: [
      { type: "hero", content: { title: "Medicina de Precisão", subtitle: "Tecnologia de ponta ao serviço da sua qualidade de vida.", buttonText: "Agendar Avaliação", backgroundImage: HERO_IMAGES.clinica } },
      { type: "features", content: { title: "Porquê Escolher-nos", items: [
        { title: "Equipamento de Última Geração", desc: "Diagnóstico mais rigoroso e seguro." },
        { title: "Equipa Médica Sénior", desc: "Especialistas com anos de experiência." },
        { title: "Atendimento Personalizado", desc: "Plano de tratamento à sua medida." },
      ] } },
      { type: "cta", content: { title: "Primeira consulta com 20% de desconto", subtitle: "Promoção válida para novos pacientes este mês.", buttonText: "Aproveitar agora" } },
      { type: "contact", content: { title: "Marcações", buttonText: "Pedir Contacto" } },
    ],
  },

  // ============== RESTAURANTE ==============
  {
    sector: "restaurante",
    name: "Restaurante Tradicional",
    description: "Modelo gastronómico clássico com ementa, testemunhos e reservas.",
    sections: [
      { type: "hero", content: { title: "Sabores que Contam Histórias", subtitle: "Cozinha tradicional portuguesa com toque contemporâneo.", buttonText: "Reservar Mesa", backgroundImage: HERO_IMAGES.restaurante } },
      { type: "features", content: { title: "A Nossa Ementa", items: [
        { title: "Entradas", desc: "Petiscos da casa e produtos da época." },
        { title: "Pratos Principais", desc: "Carnes, peixes frescos e opções vegetarianas." },
        { title: "Sobremesas", desc: "Doçaria caseira preparada diariamente." },
      ] } },
      { type: "testimonials", content: { title: "Clientes Felizes", items: [
        { title: "Ana M.", desc: "Comida deliciosa e ambiente perfeito para uma noite especial." },
        { title: "Pedro L.", desc: "Voltei três vezes na mesma semana. Vale cada cêntimo." },
      ] } },
      { type: "cta", content: { title: "Reserve a sua mesa", subtitle: "Aceitamos grupos até 30 pessoas para eventos privados.", buttonText: "Pedir Reserva" } },
      { type: "contact", content: { title: "Reservas", buttonText: "Reservar Mesa" } },
    ],
  },
  {
    sector: "restaurante",
    name: "Restaurante Moderno",
    description: "Visual urbano e descontraído para gastrobars e cozinha de autor.",
    sections: [
      { type: "hero", content: { title: "Cozinha de Autor", subtitle: "Ingredientes locais, técnicas globais. Uma experiência sensorial única.", buttonText: "Ver Ementa", backgroundImage: HERO_IMAGES.restaurante } },
      { type: "features", content: { title: "Experiências", items: [
        { title: "Menu de Degustação", desc: "7 momentos criados pelo Chef." },
        { title: "Wine Pairing", desc: "Seleção de vinhos por sommelier." },
        { title: "Eventos Privados", desc: "Espaço reservado até 40 pessoas." },
      ] } },
      { type: "cta", content: { title: "Lugares limitados todas as noites", subtitle: "Recomendamos reserva com pelo menos 48h de antecedência.", buttonText: "Reservar" } },
      { type: "contact", content: { title: "Contacto", buttonText: "Enviar" } },
    ],
  },

  // ============== CAFETARIA ==============
  {
    sector: "cafetaria",
    name: "Café Acolhedor",
    description: "Modelo aconchegante para cafés, pastelarias e brunch.",
    sections: [
      { type: "hero", content: { title: "O Seu Café Favorito", subtitle: "Pequeno-almoço, brunch e a melhor pastelaria artesanal da zona.", buttonText: "Ver Ementa", backgroundImage: HERO_IMAGES.cafetaria } },
      { type: "features", content: { title: "Especialidades", items: [
        { title: "Café de Especialidade", desc: "Grãos torrados localmente, todos os dias." },
        { title: "Pastelaria Artesanal", desc: "Feita à mão pela nossa pasteleira." },
        { title: "Brunch ao Fim de Semana", desc: "Menu completo das 10h às 16h." },
      ] } },
      { type: "testimonials", content: { title: "Quem nos visita", items: [
        { title: "Inês R.", desc: "O melhor croissant da cidade. Vou todas as semanas." },
        { title: "Tiago B.", desc: "Ambiente perfeito para trabalhar com um bom café." },
      ] } },
      { type: "contact", content: { title: "Visite-nos", buttonText: "Como Chegar" } },
    ],
  },
  {
    sector: "cafetaria",
    name: "Coffee Shop Urbano",
    description: "Identidade jovem e dinâmica para coffee shops modernos.",
    sections: [
      { type: "hero", content: { title: "Wake Up. Coffee Up.", subtitle: "Specialty coffee, snacks saudáveis e wifi rápido.", buttonText: "Encomendar", backgroundImage: HERO_IMAGES.cafetaria } },
      { type: "features", content: { title: "O que oferecemos", items: [
        { title: "Specialty Coffee", desc: "Single origin de pequenos produtores." },
        { title: "Plant-Based Menu", desc: "Opções veganas e sem glúten." },
        { title: "Co-working Friendly", desc: "Wifi grátis e tomadas em todas as mesas." },
      ] } },
      { type: "cta", content: { title: "Cartão de fidelidade digital", subtitle: "Compra 9, oferta o 10º. Sem papel, sem stress.", buttonText: "Quero o meu" } },
      { type: "contact", content: { title: "Onde estamos", buttonText: "Ver Localização" } },
    ],
  },

  // ============== ADVOCACIA ==============
  {
    sector: "advocacia",
    name: "Escritório de Advocacia",
    description: "Apresentação institucional sóbria para advogados.",
    sections: [
      { type: "hero", content: { title: "Defesa Jurídica de Confiança", subtitle: "Mais de uma década a proteger os seus direitos com rigor e discrição.", buttonText: "Marcar Reunião", backgroundImage: HERO_IMAGES.advocacia } },
      { type: "features", content: { title: "Áreas de Atuação", items: [
        { title: "Direito Civil", desc: "Contratos, responsabilidade e direito da família." },
        { title: "Direito do Trabalho", desc: "Defesa de trabalhadores e empresas." },
        { title: "Direito Imobiliário", desc: "Compra, venda e arrendamento." },
        { title: "Direito Comercial", desc: "Constituição de empresas e contratos." },
      ] } },
      { type: "testimonials", content: { title: "Clientes que Confiaram", items: [
        { title: "Empresa X, S.A.", desc: "Profissionalismo absoluto. Resolveram um caso complexo em tempo recorde." },
        { title: "Carla F.", desc: "Sempre disponíveis para esclarecer todas as dúvidas." },
      ] } },
      { type: "cta", content: { title: "Consulta Inicial sem Compromisso", subtitle: "Avaliamos o seu caso de forma confidencial.", buttonText: "Pedir Contacto" } },
      { type: "contact", content: { title: "Contactos", buttonText: "Enviar" } },
    ],
  },
  {
    sector: "advocacia",
    name: "Advogado Particular",
    description: "Modelo focado para advogados individuais ou pequenos escritórios.",
    sections: [
      { type: "hero", content: { title: "O Seu Advogado de Confiança", subtitle: "Atendimento personalizado para particulares e pequenas empresas.", buttonText: "Falar Comigo", backgroundImage: HERO_IMAGES.advocacia } },
      { type: "features", content: { title: "Como Posso Ajudar", items: [
        { title: "Divórcios e Família", desc: "Mediação e processos litigiosos." },
        { title: "Heranças", desc: "Partilhas e questões sucessórias." },
        { title: "Contratos", desc: "Análise e elaboração de contratos." },
      ] } },
      { type: "cta", content: { title: "Primeira reunião gratuita", subtitle: "30 minutos para avaliarmos o seu caso, sem compromisso.", buttonText: "Marcar agora" } },
      { type: "contact", content: { title: "Contacto Direto", buttonText: "Enviar" } },
    ],
  },

  // ============== IMOBILIÁRIA ==============
  {
    sector: "imobiliaria",
    name: "Imobiliária de Referência",
    description: "Modelo profissional para mediadoras e consultores imobiliários.",
    sections: [
      { type: "hero", content: { title: "A Sua Próxima Casa Está Aqui", subtitle: "Compra, venda e arrendamento com acompanhamento de A a Z.", buttonText: "Ver Imóveis", backgroundImage: HERO_IMAGES.imobiliaria } },
      { type: "features", content: { title: "Os Nossos Serviços", items: [
        { title: "Avaliação Gratuita", desc: "Saiba quanto vale o seu imóvel em 24h." },
        { title: "Gestão de Arrendamento", desc: "Tratamos de tudo para si, sem preocupações." },
        { title: "Crédito Habitação", desc: "Negociamos as melhores condições com a banca." },
      ] } },
      { type: "testimonials", content: { title: "Quem nos confiou a sua casa", items: [
        { title: "Família Silva", desc: "Venderam a nossa casa em duas semanas pelo valor que pedimos." },
        { title: "Ricardo T.", desc: "Encontraram-me o apartamento perfeito. Profissionais excecionais." },
      ] } },
      { type: "cta", content: { title: "Quer vender o seu imóvel?", subtitle: "Avaliação grátis e sem compromisso em 24h.", buttonText: "Pedir Avaliação" } },
      { type: "contact", content: { title: "Fale Connosco", buttonText: "Enviar" } },
    ],
  },
  {
    sector: "imobiliaria",
    name: "Consultor Imobiliário",
    description: "Identidade pessoal para consultores independentes de luxo.",
    sections: [
      { type: "hero", content: { title: "Imóveis Exclusivos, Atendimento Único", subtitle: "Especializado em propriedades de prestígio na sua região.", buttonText: "Ver Portfólio", backgroundImage: HERO_IMAGES.imobiliaria } },
      { type: "features", content: { title: "Diferenciais", items: [
        { title: "Marketing Premium", desc: "Fotografia profissional, vídeo e drone." },
        { title: "Rede Internacional", desc: "Acesso a compradores estrangeiros." },
        { title: "Confidencialidade Total", desc: "Discrição em transações de alto valor." },
      ] } },
      { type: "cta", content: { title: "Vamos conversar", subtitle: "Avaliação gratuita e estratégia personalizada.", buttonText: "Agendar reunião" } },
      { type: "contact", content: { title: "Contacto", buttonText: "Enviar" } },
    ],
  },

  // ============== SALÃO DE BELEZA ==============
  {
    sector: "salao_beleza",
    name: "Salão & SPA",
    description: "Modelo elegante para salões completos com cabelo, estética e SPA.",
    sections: [
      { type: "hero", content: { title: "Realce a Sua Beleza Natural", subtitle: "Cabelo, estética facial, manicure e SPA num só espaço.", buttonText: "Marcar", backgroundImage: HERO_IMAGES.salao_beleza } },
      { type: "features", content: { title: "Serviços", items: [
        { title: "Cabelo", desc: "Cortes, coloração e tratamentos profissionais." },
        { title: "Unhas", desc: "Manicure, pedicure e nail art." },
        { title: "Estética Facial", desc: "Limpezas, peelings e tratamentos anti-idade." },
        { title: "Massagens", desc: "Relaxamento e bem-estar em ambiente SPA." },
      ] } },
      { type: "testimonials", content: { title: "Clientes Felizes", items: [
        { title: "Sofia C.", desc: "O melhor salão da cidade. Saio sempre a sentir-me uma rainha." },
        { title: "Margarida P.", desc: "Profissionalismo e simpatia em todas as visitas." },
      ] } },
      { type: "cta", content: { title: "Pacote Bem-Estar", subtitle: "Cabelo + manicure + massagem por preço especial.", buttonText: "Reservar Pacote" } },
      { type: "contact", content: { title: "Marcações", buttonText: "Marcar" } },
    ],
  },
  {
    sector: "salao_beleza",
    name: "Barbearia Clássica",
    description: "Modelo masculino com estética vintage para barbearias.",
    sections: [
      { type: "hero", content: { title: "Tradição & Estilo", subtitle: "Cortes clássicos e barba feita à navalha por mestres barbeiros.", buttonText: "Marcar Hora", backgroundImage: HERO_IMAGES.salao_beleza } },
      { type: "features", content: { title: "Serviços", items: [
        { title: "Corte Clássico", desc: "Tesoura, máquina e acabamento à navalha." },
        { title: "Barba", desc: "Toalha quente, óleos e acabamento perfeito." },
        { title: "Combo Pai & Filho", desc: "Experiência única para os dois." },
      ] } },
      { type: "cta", content: { title: "Cartão de Cliente", subtitle: "À 10ª visita, oferta o corte. Simples assim.", buttonText: "Quero o meu" } },
      { type: "contact", content: { title: "Onde estamos", buttonText: "Ver Mapa" } },
    ],
  },

  // ============== FITNESS ==============
  {
    sector: "fitness",
    name: "Ginásio Completo",
    description: "Modelo enérgico para ginásios, crossbox e estúdios funcionais.",
    sections: [
      { type: "hero", content: { title: "Transforme o Seu Corpo. Eleve a Sua Mente.", subtitle: "Equipamento de ponta, treinadores certificados e mais de 30 aulas por semana.", buttonText: "Aula Experimental Grátis", backgroundImage: HERO_IMAGES.fitness } },
      { type: "features", content: { title: "O Que Oferecemos", items: [
        { title: "Sala de Musculação", desc: "Equipamento profissional 24/7." },
        { title: "Aulas de Grupo", desc: "Spinning, yoga, pilates, crossfit e mais." },
        { title: "Personal Training", desc: "Acompanhamento individual personalizado." },
        { title: "Nutricionista", desc: "Plano alimentar incluído nos planos premium." },
      ] } },
      { type: "testimonials", content: { title: "Resultados Reais", items: [
        { title: "Bruno T.", desc: "Perdi 18 kg em 6 meses. Mudou-me a vida." },
        { title: "Helena M.", desc: "Ambiente acolhedor e treinadores fantásticos." },
      ] } },
      { type: "cta", content: { title: "Sem matrícula este mês", subtitle: "Inscrição gratuita até ao fim do mês. Lugares limitados.", buttonText: "Inscrever Agora" } },
      { type: "contact", content: { title: "Visite-nos", buttonText: "Marcar Visita" } },
    ],
  },
  {
    sector: "fitness",
    name: "Personal Trainer",
    description: "Modelo individual para personal trainers e coaches online.",
    sections: [
      { type: "hero", content: { title: "O Seu Treino. O Seu Resultado.", subtitle: "Treinos personalizados presenciais ou online com acompanhamento total.", buttonText: "Avaliação Grátis", backgroundImage: HERO_IMAGES.fitness } },
      { type: "features", content: { title: "Como Trabalho", items: [
        { title: "Avaliação Inicial", desc: "Composição corporal, objetivos e plano." },
        { title: "Treinos Personalizados", desc: "Adaptados ao seu nível e disponibilidade." },
        { title: "App de Acompanhamento", desc: "Veja o seu progresso semana a semana." },
      ] } },
      { type: "cta", content: { title: "Primeira sessão gratuita", subtitle: "Vamos conhecer-nos antes de qualquer compromisso.", buttonText: "Marcar agora" } },
      { type: "contact", content: { title: "Contacto", buttonText: "Enviar" } },
    ],
  },

  // ============== LOJA DE ROUPA ==============
  {
    sector: "loja_roupa",
    name: "Boutique de Moda",
    description: "Modelo elegante para boutiques de roupa feminina ou masculina.",
    sections: [
      { type: "hero", content: { title: "Coleção Outono/Inverno", subtitle: "Peças exclusivas, edição limitada. Visite-nos ou compre online.", buttonText: "Ver Coleção", backgroundImage: HERO_IMAGES.loja_roupa } },
      { type: "features", content: { title: "Categorias", items: [
        { title: "Vestidos", desc: "Do casual ao formal, peças únicas." },
        { title: "Acessórios", desc: "Carteiras, lenços e bijuteria selecionada." },
        { title: "Calçado", desc: "Marcas portuguesas e internacionais." },
      ] } },
      { type: "testimonials", content: { title: "Clientes Fiéis", items: [
        { title: "Catarina F.", desc: "Encontro sempre peças que ninguém mais tem. Adoro!" },
        { title: "Beatriz V.", desc: "Atendimento personalizado e estilo impecável." },
      ] } },
      { type: "cta", content: { title: "Newsletter Exclusiva", subtitle: "Acesso antecipado a novas coleções e descontos privados.", buttonText: "Subscrever" } },
      { type: "contact", content: { title: "Visite a Loja", buttonText: "Ver Localização" } },
    ],
  },
  {
    sector: "loja_roupa",
    name: "Streetwear",
    description: "Identidade jovem e urbana para lojas de streetwear e sneakers.",
    sections: [
      { type: "hero", content: { title: "Drop Novo. Edição Limitada.", subtitle: "As últimas tendências streetwear chegaram. Stock limitado.", buttonText: "Comprar Agora", backgroundImage: HERO_IMAGES.loja_roupa } },
      { type: "features", content: { title: "Em Destaque", items: [
        { title: "Sneakers", desc: "Releases exclusivos e edições raras." },
        { title: "Hoodies & Tees", desc: "Marcas globais e produção independente." },
        { title: "Acessórios", desc: "Caps, mochilas e mais." },
      ] } },
      { type: "cta", content: { title: "Free shipping > 50€", subtitle: "Entrega rápida em Portugal continental.", buttonText: "Ver Loja" } },
      { type: "contact", content: { title: "Contacto", buttonText: "Enviar" } },
    ],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let { data: project } = await admin
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!project) {
      const { data: newProj, error: pErr } = await admin
        .from("projects")
        .insert({ user_id: user.id, name: "Templates do Sistema" })
        .select("id")
        .single();
      if (pErr || !newProj) {
        return new Response(JSON.stringify({ error: "Falha a criar projeto seed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      project = newProj;
    }

    let landingPageId: string;
    const { data: lp } = await admin
      .from("landing_pages")
      .select("id")
      .eq("project_id", project.id)
      .limit(1)
      .maybeSingle();
    if (lp) {
      landingPageId = lp.id;
    } else {
      const { data: newLp, error: lpErr } = await admin
        .from("landing_pages")
        .insert({ project_id: project.id, user_id: user.id, name: "Templates", slug: "templates" })
        .select("id")
        .single();
      if (lpErr || !newLp) {
        return new Response(JSON.stringify({ error: "Falha a criar landing seed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      landingPageId = newLp.id;
    }

    const created: string[] = [];
    const skipped: string[] = [];

    for (const tpl of TEMPLATES) {
      const { data: existing } = await admin
        .from("pages")
        .select("id")
        .eq("is_template", true)
        .eq("template_sector", tpl.sector)
        .eq("template_name", tpl.name)
        .maybeSingle();

      if (existing) {
        skipped.push(tpl.name);
        continue;
      }

      const slug = `tpl-${tpl.sector}-${tpl.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
      const { data: page, error: pageErr } = await admin
        .from("pages")
        .insert({
          user_id: user.id,
          project_id: project.id,
          title: tpl.name,
          slug,
          is_template: true,
          template_sector: tpl.sector,
          template_name: tpl.name,
          template_description: tpl.description,
        })
        .select("id")
        .single();

      if (pageErr || !page) {
        console.error("[seed-templates] page insert error:", pageErr);
        continue;
      }

      const rows = tpl.sections.map((s, i) => ({
        landing_page_id: landingPageId,
        page_id: page.id,
        user_id: user.id,
        type: s.type,
        sort_order: i,
        content: s.content,
      }));

      const { error: secErr } = await admin.from("page_sections").insert(rows);
      if (secErr) {
        console.error("[seed-templates] sections insert error:", secErr);
        continue;
      }

      created.push(tpl.name);
    }

    return new Response(
      JSON.stringify({ success: true, created, skipped, total: TEMPLATES.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[seed-templates] internal:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
