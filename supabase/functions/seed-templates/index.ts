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

const TEMPLATES: SeedTemplate[] = [
  {
    sector: "clinica",
    name: "Clínica Moderna",
    description: "Layout profissional para clínicas e consultórios médicos.",
    sections: [
      {
        type: "hero",
        content: {
          title: "Cuidados de Saúde de Excelência",
          subtitle: "Equipa especializada ao serviço do seu bem-estar.",
          buttonText: "Marcar Consulta",
        },
      },
      {
        type: "features",
        content: {
          title: "Especialidades",
          items: [
            { title: "Medicina Geral", desc: "Acompanhamento contínuo da sua saúde." },
            { title: "Pediatria", desc: "Cuidados dedicados aos mais novos." },
            { title: "Análises Clínicas", desc: "Diagnósticos rápidos e fiáveis." },
          ],
        },
      },
      {
        type: "cta",
        content: {
          title: "Reserve já a sua consulta",
          subtitle: "Atendimento personalizado de segunda a sábado.",
          buttonText: "Contactar",
        },
      },
      {
        type: "contact",
        content: { title: "Fale Connosco", buttonText: "Enviar Mensagem" },
      },
    ],
  },
  {
    sector: "restaurante",
    name: "Restaurante Acolhedor",
    description: "Modelo gastronómico com ementa e reservas.",
    sections: [
      {
        type: "hero",
        content: {
          title: "Sabores que Contam Histórias",
          subtitle: "Cozinha tradicional com toque moderno.",
          buttonText: "Reservar Mesa",
        },
      },
      {
        type: "features",
        content: {
          title: "A Nossa Ementa",
          items: [
            { title: "Entradas", desc: "Petiscos da casa e produtos da época." },
            { title: "Pratos Principais", desc: "Carnes, peixes e opções vegetarianas." },
            { title: "Sobremesas", desc: "Doçaria caseira irresistível." },
          ],
        },
      },
      {
        type: "testimonials",
        content: {
          title: "O Que Dizem os Clientes",
          items: [
            { title: "Ana M.", desc: "Comida deliciosa e ambiente perfeito!" },
            { title: "João P.", desc: "Voltei três vezes na mesma semana." },
          ],
        },
      },
      { type: "contact", content: { title: "Reservas", buttonText: "Reservar" } },
    ],
  },
  {
    sector: "advocacia",
    name: "Escritório de Advocacia",
    description: "Apresentação institucional sóbria para advogados.",
    sections: [
      {
        type: "hero",
        content: {
          title: "Defesa Jurídica de Confiança",
          subtitle: "Mais de uma década a proteger os seus direitos.",
          buttonText: "Marcar Reunião",
        },
      },
      {
        type: "features",
        content: {
          title: "Áreas de Atuação",
          items: [
            { title: "Direito Civil", desc: "Contratos, responsabilidade e família." },
            { title: "Direito do Trabalho", desc: "Defesa de trabalhadores e empresas." },
            { title: "Imobiliário", desc: "Compra, venda e arrendamento." },
          ],
        },
      },
      {
        type: "cta",
        content: {
          title: "Consulta Inicial Sem Compromisso",
          subtitle: "Avaliamos o seu caso de forma confidencial.",
          buttonText: "Pedir Contacto",
        },
      },
      { type: "contact", content: { title: "Contactos", buttonText: "Enviar" } },
    ],
  },
  {
    sector: "salao_beleza",
    name: "Salão de Beleza",
    description: "Modelo elegante para salões, barbearias e spas.",
    sections: [
      {
        type: "hero",
        content: {
          title: "Realce a Sua Beleza Natural",
          subtitle: "Serviços de cabeleireiro, estética e barbearia.",
          buttonText: "Agendar",
        },
      },
      {
        type: "features",
        content: {
          title: "Serviços",
          items: [
            { title: "Cabelo", desc: "Cortes, coloração e tratamentos." },
            { title: "Unhas", desc: "Manicure, pedicure e nail art." },
            { title: "Estética", desc: "Tratamentos faciais e corporais." },
          ],
        },
      },
      {
        type: "cta",
        content: {
          title: "Agende a sua sessão hoje",
          subtitle: "Promoções semanais para clientes fiéis.",
          buttonText: "Marcar",
        },
      },
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

    // Garantir um projeto "system" do owner para hospedar templates
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
      // Idempotente: se já existir um template com este nome+setor, ignora
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

      const slug = `tpl-${tpl.sector}-${Date.now()}`;
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
      JSON.stringify({ success: true, created, skipped }),
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
