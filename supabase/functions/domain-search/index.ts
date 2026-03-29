const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HOSTINGER_API_BASE = "https://developers.hostinger.com";

// ── Markup / Profit Rules ──
// Preço de venda = preço Hostinger + margem
// Regras por TLD para garantir lucro mínimo
const MARKUP_RULES: Record<string, { fixed: number; percent: number; minSale: number }> = {
  // TLDs premium — margem alta
  ai:   { fixed: 15, percent: 0.30, minSale: 69.99 },
  io:   { fixed: 12, percent: 0.25, minSale: 49.99 },
  dev:  { fixed: 10, percent: 0.25, minSale: 24.99 },
  app:  { fixed: 10, percent: 0.25, minSale: 24.99 },
  tech: { fixed: 8,  percent: 0.20, minSale: 19.99 },
  // TLDs populares — margem moderada
  com:  { fixed: 5,  percent: 0.20, minSale: 14.99 },
  net:  { fixed: 5,  percent: 0.20, minSale: 14.99 },
  org:  { fixed: 5,  percent: 0.20, minSale: 14.99 },
  pt:   { fixed: 5,  percent: 0.20, minSale: 12.99 },
  eu:   { fixed: 5,  percent: 0.20, minSale: 12.99 },
  // TLDs económicos
  me:   { fixed: 4,  percent: 0.15, minSale: 9.99 },
  co:   { fixed: 5,  percent: 0.20, minSale: 14.99 },
  xyz:  { fixed: 3,  percent: 0.15, minSale: 5.99 },
  site: { fixed: 3,  percent: 0.15, minSale: 5.99 },
};
const DEFAULT_MARKUP = { fixed: 5, percent: 0.20, minSale: 14.99 };

function applyMarkup(costPrice: number, tld: string): number {
  const rule = MARKUP_RULES[tld.toLowerCase()] || DEFAULT_MARKUP;
  // Preço = custo + fixo + percentagem do custo
  const calculated = costPrice + rule.fixed + (costPrice * rule.percent);
  // Nunca vender abaixo do mínimo definido
  const final = Math.max(calculated, rule.minSale);
  // Arredondar a .99
  return Math.ceil(final) - 0.01;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HOSTINGER_API_TOKEN = Deno.env.get("HOSTINGER_API_TOKEN");
    if (!HOSTINGER_API_TOKEN) {
      throw new Error("HOSTINGER_API_TOKEN not configured");
    }

    const { domain } = await req.json();
    if (!domain || typeof domain !== "string") {
      return new Response(
        JSON.stringify({ error: "Domínio inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const parts = cleanDomain.split(".");
    const sld = parts[0];
    const tld = parts.length >= 2 ? parts.slice(1).join(".") : "com";

    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HOSTINGER_API_TOKEN}`,
    };

    const popularTlds = ["com", "pt", "ai", "eu", "net", "io", "org", "dev", "app", "me", "xyz", "tech", "site", "co"];
    const allTlds = [tld, ...popularTlds.filter((t) => t !== tld)];

    console.log("[domain-search] Searching:", { sld, tld, allTlds });

    // Fetch availability + multiple catalog queries in parallel for better TLD matching
    const catalogQueries = allTlds.map((t) =>
      fetch(`${HOSTINGER_API_BASE}/api/billing/v1/catalog?category=domain_tld&name=.${t.toUpperCase()}*`, {
        headers: { Authorization: `Bearer ${HOSTINGER_API_TOKEN}` },
      })
    );

    const [availRes, ...catalogResponses] = await Promise.all([
      fetch(`${HOSTINGER_API_BASE}/api/domains/v1/availability`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ domain: sld, tlds: allTlds }),
      }),
      ...catalogQueries,
    ]);

    // --- Parse availability ---
    const availText = await availRes.text();
    console.log(`[domain-search] Availability RAW [${availRes.status}]:`, availText);

    if (!availRes.ok) {
      throw new Error(`Hostinger availability error ${availRes.status}: ${availText}`);
    }

    const availData = JSON.parse(availText);
    const results: Array<{
      domain: string;
      is_available: boolean;
      is_alternative: boolean;
      restriction: string | null;
    }> = Array.isArray(availData) ? availData : [];

    // --- Parse catalog pricing ---
    const priceMap: Record<string, number> = {};

    for (let i = 0; i < catalogResponses.length; i++) {
      const t = allTlds[i];
      const res = catalogResponses[i];
      try {
        const text = await res.text();
        console.log(`[domain-search] Catalog .${t} RAW [${res.status}]:`, text);

        if (!res.ok) continue;

        const data = JSON.parse(text);
        const items = Array.isArray(data) ? data : data.data || [];

        for (const item of items) {
          // Extract price from item — prices are in cents
          const prices = item.prices || [];
          // Prefer 1-year price
          const yearlyPrice = prices.find((p: any) =>
            (p.period === 1 && (p.period_unit === "year" || p.period_unit === "years"))
          );
          const bestPrice = yearlyPrice || prices[0];

          if (bestPrice) {
            const amount = bestPrice.price ?? bestPrice.amount ?? bestPrice.renewal_price ?? 0;
            priceMap[t] = amount / 100; // cents to euros
            console.log(`[domain-search] Price for .${t}: ${priceMap[t]}€ (raw: ${amount} cents)`);
          }
        }
      } catch (e) {
        console.warn(`[domain-search] Catalog parse error for .${t}:`, e);
      }
    }

    // If per-TLD queries returned empty, try the bulk catalog as fallback
    if (Object.keys(priceMap).length === 0) {
      console.log("[domain-search] Per-TLD catalog empty, trying bulk catalog...");
      try {
        const bulkRes = await fetch(`${HOSTINGER_API_BASE}/api/billing/v1/catalog?category=domain_tld`, {
          headers: { Authorization: `Bearer ${HOSTINGER_API_TOKEN}` },
        });
        const bulkText = await bulkRes.text();
        console.log(`[domain-search] Bulk catalog RAW [${bulkRes.status}]:`, bulkText.slice(0, 2000));

        if (bulkRes.ok) {
          const bulkData = JSON.parse(bulkText);
          const items = Array.isArray(bulkData) ? bulkData : bulkData.data || [];
          for (const item of items) {
            const id = (item.id || "").toLowerCase();
            const name = (item.name || "").toLowerCase();
            const slug = (item.slug || "").toLowerCase();

            // Try multiple patterns to extract TLD
            let itemTld = "";
            // Pattern: ".com" in name
            const dotMatch = name.match(/\.([a-z]{2,})$/);
            if (dotMatch) itemTld = dotMatch[1];
            // Pattern: "domain-com" or "domain_com" in id
            if (!itemTld) {
              const idMatch = id.match(/domain[_-]([a-z]{2,})$/);
              if (idMatch) itemTld = idMatch[1];
            }
            // Pattern: slug contains TLD
            if (!itemTld) {
              for (const t of allTlds) {
                if (slug.includes(t) || name.includes(`.${t}`) || id.endsWith(t)) {
                  itemTld = t;
                  break;
                }
              }
            }

            if (itemTld && item.prices?.length) {
              const yearlyPrice = item.prices.find((p: any) => p.period === 1 && (p.period_unit === "year" || p.period_unit === "years"));
              const price = yearlyPrice || item.prices[0];
              const amount = price.price ?? price.amount ?? price.renewal_price ?? 0;
              priceMap[itemTld] = amount / 100;
            }
          }
        }
      } catch (e) {
        console.warn("[domain-search] Bulk catalog error:", e);
      }
    }

    console.log("[domain-search] Final priceMap:", JSON.stringify(priceMap));

    // --- Build response with MARKUP ---
    const mainResult = results.find((r) => r.domain === cleanDomain);
    const mainAvailable = mainResult?.is_available ?? false;
    const mainCostPrice = priceMap[tld] ?? 0;
    const mainSalePrice = mainCostPrice > 0 ? applyMarkup(mainCostPrice, tld) : 0;

    console.log(`[domain-search] Main: cost=${mainCostPrice}€, sale=${mainSalePrice}€, margin=${(mainSalePrice - mainCostPrice).toFixed(2)}€`);

    const suggestions = results
      .filter((r) => r.domain !== cleanDomain && r.is_available)
      .map((r) => {
        const rTld = r.domain.split(".").slice(1).join(".");
        const costPrice = priceMap[rTld] ?? 0;
        const salePrice = costPrice > 0 ? applyMarkup(costPrice, rTld) : 0;
        return {
          domain: r.domain,
          tld: rTld,
          available: true,
          restriction: r.restriction,
          price: salePrice,
          costPrice, // internal reference
        };
      });

    const response = {
      domain: cleanDomain,
      available: mainAvailable,
      price: mainSalePrice,
      costPrice: mainCostPrice,
      tld,
      suggestions,
    };

    console.log("[domain-search] Final response:", JSON.stringify(response));

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[domain-search] ERROR:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
