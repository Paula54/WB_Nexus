import type { WebsiteSection } from "@/types/nexus";

export interface BuilderBusinessData {
  name: string;
  legalName?: string;
  sector?: string;
  normalizedSector?: string;
  description?: string;
  city?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export interface BuilderBrandDefaults {
  colors: { primary: string; secondary: string; accent: string };
  fonts: { heading: string; body: string };
}

export function normalizeBusinessSector(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/(imobili|real estate|property|propriedade|mediacao)/.test(normalized)) return "imobiliaria";
  if (/(clinica|saude|medic)/.test(normalized)) return "clinica";
  if (/(restaurante|restaurant)/.test(normalized)) return "restaurante";
  if (/(cafe|cafetaria)/.test(normalized)) return "cafetaria";
  if (/(advoc|jurid|legal)/.test(normalized)) return "advocacia";
  if (/(fitness|ginasio|personal trainer)/.test(normalized)) return "fitness";
  if (/(beleza|salao|spa|cabelo|estetica)/.test(normalized)) return "salao_beleza";
  return normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || null;
}

export function getSectorBrandDefaults(sector?: string | null): BuilderBrandDefaults {
  const normalized = normalizeBusinessSector(sector);
  if (normalized === "imobiliaria") {
    return {
      colors: { primary: "#0f766e", secondary: "#0f172a", accent: "#d4af37" },
      fonts: { heading: "Montserrat", body: "Open Sans" },
    };
  }

  return {
    colors: { primary: "#667eea", secondary: "#764ba2", accent: "#f59e0b" },
    fonts: { heading: "Inter", body: "Inter" },
  };
}

function contentText(content: WebsiteSection["content"]): string {
  return JSON.stringify(content || {})
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function sectionNeedsBusinessRewrite(section: WebsiteSection, sector?: string | null): boolean {
  const text = contentText(section.content);
  const generic = [
    "salao de beleza",
    "beleza natural",
    "manicure",
    "spa",
    "cabelo",
    "bem-vindo ao seu negocio",
    "transforme a sua presenca digital",
    "as nossas funcionalidades",
    "nova seccao",
    "novo item",
    "descricao do item",
  ];
  if (generic.some((placeholder) => text.includes(placeholder))) return true;
  return normalizeBusinessSector(sector) === "imobiliaria" && /(estetica|cosmetic|beauty|wellness)/.test(text);
}

export function buildBusinessFallbackSection(
  section: WebsiteSection,
  business: BuilderBusinessData,
): WebsiteSection["content"] {
  const name = business.name || "Cascais Property";
  const city = business.city || "Cascais";
  const isRealEstate = business.normalizedSector === "imobiliaria";

  if (!isRealEstate) {
    return {
      ...section.content,
      title: section.content.title?.replace(/Salão de Beleza|Seu Negócio/gi, name) || name,
    };
  }

  if (section.type === "hero") {
    return {
      ...section.content,
      title: `${name}: imóveis selecionados em ${city}`,
      subtitle: "Mediação imobiliária com curadoria local, acompanhamento próximo e foco em vender melhor.",
      buttonText: "Ver imóveis",
      backgroundImage:
        section.content.backgroundImage ||
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=80",
    };
  }

  if (section.type === "features") {
    return {
      ...section.content,
      title: "Serviços imobiliários orientados a resultados",
      items: [
        { title: "Venda de imóveis", desc: "Estratégia de preço, apresentação premium e acompanhamento até à escritura." },
        { title: "Compra acompanhada", desc: "Seleção criteriosa de oportunidades para famílias e investidores." },
        { title: "Avaliação local", desc: "Análise do mercado em Cascais para decisões rápidas e fundamentadas." },
      ],
    };
  }

  if (section.type === "testimonials") {
    return {
      ...section.content,
      title: "Clientes que confiaram na nossa mediação",
      items: [
        { title: "Proprietário em Cascais", desc: "Processo claro, comunicação constante e venda fechada com confiança." },
        { title: "Comprador internacional", desc: "Encontrámos a casa certa com acompanhamento local do início ao fim." },
        { title: "Investidor", desc: "A análise de mercado ajudou-nos a decidir com segurança." },
      ],
    };
  }

  if (section.type === "cta") {
    return {
      ...section.content,
      title: "Pronto para vender ou comprar em Cascais?",
      subtitle: "Fala connosco e recebe uma orientação objetiva para o teu próximo passo imobiliário.",
      buttonText: "Agendar contacto",
    };
  }

  if (section.type === "contact") {
    return {
      ...section.content,
      title: "Contacta a equipa",
      subtitle: "Partilha o imóvel ou objetivo de compra e respondemos com próximos passos claros.",
      buttonText: "Enviar pedido",
    };
  }

  return section.content;
}