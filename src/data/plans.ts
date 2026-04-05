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
    setupPriceId: "price_1TDWH1E6rYpESbYpH1HEB8pY",
    subscriptionPriceId: "price_1TDWcVE6rYpESbYpc6Pv0Gp6",
    description: "SEO e Validação",
  },
  "nexus-growth": {
    slug: "nexus-growth",
    key: "GROWTH",
    name: "Nexus Growth",
    setupFee: 1490,
    monthlyPrice: 149,
    setupPriceId: "price_1TDWIjE6rYpESbYpkkajePcW",
    subscriptionPriceId: "price_1TDWfxE6rYpESbYpuWFi5qnL",
    description: "Blog IA, Ads e Newsletters",
  },
  "nexus-os": {
    slug: "nexus-os",
    key: "NEXUS_OS",
    name: "Nexus OS",
    setupFee: 2490,
    monthlyPrice: 299,
    setupPriceId: "price_1TDWJPE6rYpESbYpbzTCDw0h",
    subscriptionPriceId: "price_1TDWwyE6rYpESbYpHEHNEeAG",
    description: "WhatsApp AI, CRM e Gestão Total",
  },
};

export function getPlanBySlug(slug: string | null): PlanConfig | null {
  if (!slug) return null;
  return PLANS[slug.toLowerCase()] ?? null;
}
