export interface PlanConfig {
  slug: string;
  key: "START" | "GROWTH" | "NEXUS_OS";
  name: string;
  setupFee: number;
  monthlyPrice: number;
  setupPriceId: string;
  subscriptionPriceId: string;
  description: string;
}

export const PLANS: Record<string, PlanConfig> = {
  "nexus-start": {
    slug: "nexus-start",
    key: "START",
    name: "Nexus Start",
    setupFee: 790,
    monthlyPrice: 49,
    setupPriceId: "price_1TGJ8PCn71ikcRodZLjE5sOc",
    subscriptionPriceId: "price_1TGJ8mCn71ikcRodTECWJ7X2",
    description: "SEO e Validação",
  },
  "nexus-growth": {
    slug: "nexus-growth",
    key: "GROWTH",
    name: "Nexus Growth",
    setupFee: 1490,
    monthlyPrice: 149,
    setupPriceId: "price_1TGJ9BCn71ikcRod7nlXTr7k",
    subscriptionPriceId: "price_1TGJ9UCn71ikcRod92KW9IVM",
    description: "Blog IA, Ads e Newsletters",
  },
  "nexus-os": {
    slug: "nexus-os",
    key: "NEXUS_OS",
    name: "Nexus OS",
    setupFee: 2490,
    monthlyPrice: 299,
    setupPriceId: "price_1TGJ9pCn71ikcRod8kPmXALe",
    subscriptionPriceId: "price_1TGJA6Cn71ikcRod5pxIgmuY",
    description: "WhatsApp AI, CRM e Gestão Total",
  },
};

export function getPlanBySlug(slug: string | null): PlanConfig | null {
  if (!slug) return null;
  return PLANS[slug.toLowerCase()] ?? null;
}
