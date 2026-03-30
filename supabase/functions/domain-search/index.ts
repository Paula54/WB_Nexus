const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HOSTINGER_API_BASE = "https://developers.hostinger.com";
const USER_AGENT = "NexusMachine/1.0 (Domain Reseller; contact@web-business.pt)";

// ── Markup / Profit Rules ──
// Sale price = Hostinger cost + margin
const MARKUP_RULES: Record<string, { fixed: number; percent: number; minSale: number }> = {
  ai:   { fixed: 15, percent: 0.30, minSale: 69.99 },
  io:   { fixed: 12, percent: 0.25, minSale: 49.99 },
  dev:  { fixed: 10, percent: 0.25, minSale: 24.99 },
  app:  { fixed: 10, percent: 0.25, minSale: 24.99 },
  tech: { fixed: 8,  percent: 0.20, minSale: 19.99 },
  com:  { fixed: 5,  percent: 0.20, minSale: 14.99 },
  net:  { fixed: 5,  percent: 0.20, minSale: 14.99 },
  org:  { fixed: 5,  percent: 0.20, minSale: 14.99 },
  pt:   { fixed: 5,  percent: 0.20, minSale: 12.99 },
  eu:   { fixed: 5,  percent: 0.20, minSale: 12.99 },
  me:   { fixed: 4,  percent: 0.15, minSale: 9.99 },
  co:   { fixed: 5,  percent: 0.20, minSale: 14.99 },
  xyz:  { fixed: 3,  percent: 0.15, minSale: 5.99 },
  site: { fixed: 3,  percent: 0.15, minSale: 5.99 },
};
const DEFAULT_MARKUP = { fixed: 5, percent: 0.20, minSale: 14.99 };

function applyMarkup(costPrice: number, tld: string): number {
  const rule = MARKUP_RULES[tld.toLowerCase()] || DEFAULT_MARKUP;
  const calculated = costPrice + rule.fixed + (costPrice * rule.percent);
  const final = Math.max(calculated, rule.minSale);
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
    const sld = parts[0]; // domain name without TLD
    const tld = parts.length >= 2 ? parts.slice(1).join(".") : "com";

    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HOSTINGER_API_TOKEN}`,
      "User-Agent": USER_AGENT,
      "Accept": "application/json",
    };

    const popularTlds = ["com", "pt", "ai", "eu", "net", "io", "org", "dev", "app", "me", "xyz", "tech", "site", "co"];
    const otherTlds = popularTlds.filter((t) => t !== tld);

    console.log("[domain-search] Searching:", { sld, tld, otherTlds });

    // ── 1a. Check primary TLD with alternatives (single TLD required for alternatives) ──
    let results: Array<{
      domain: string;
      is_available: boolean;
      is_alternative: boolean;
      restriction: string | null;
    }> = [];

    try {
      const primaryRes = await fetch(`${HOSTINGER_API_BASE}/api/domains/v1/availability`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ domain: sld, tlds: [tld], with_alternatives: true }),
      });
      const primaryText = await primaryRes.text();
      console.log(`[domain-search] Primary .${tld} [${primaryRes.status}]:`, primaryText.slice(0, 500));
      if (primaryRes.ok) {
        const parsed = JSON.parse(primaryText);
        results = Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error("[domain-search] Primary check error:", e);
    }

    // ── 1b. Check other popular TLDs (no alternatives needed, batch allowed) ──
    try {
      const otherRes = await fetch(`${HOSTINGER_API_BASE}/api/domains/v1/availability`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ domain: sld, tlds: otherTlds }),
      });
      const otherText = await otherRes.text();
      console.log(`[domain-search] Other TLDs [${otherRes.status}]:`, otherText.slice(0, 300));
      if (otherRes.ok) {
        const parsed = JSON.parse(otherText);
        const otherResults = Array.isArray(parsed) ? parsed : [];
        results = [...results, ...otherResults];
      }
    } catch (e) {
      console.error("[domain-search] Other TLDs check error:", e);
    }

    if (results.length === 0) {
      console.error("[domain-search] No results from Hostinger API");
      return new Response(
        JSON.stringify({ domain: cleanDomain, available: false, price: 0, costPrice: 0, tld, itemId: "", suggestions: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[domain-search] Got ${results.length} results`);
    const allTlds = [tld, ...otherTlds];

    // ── 2. Get pricing from catalog (GET /api/billing/v1/catalog?category=DOMAIN) ──
    // Official API: category=DOMAIN, name=.COM* (wildcard search)
    // Prices are in CENTS (e.g. 1799 = 17.99€)
    const priceMap: Record<string, { costPrice: number; itemId: string }> = {};

    const catalogQueries = allTlds.map((t) =>
      fetch(`${HOSTINGER_API_BASE}/api/billing/v1/catalog?category=DOMAIN&name=.${t.toUpperCase()}*`, {
        headers: { Authorization: `Bearer ${HOSTINGER_API_TOKEN}`, "User-Agent": USER_AGENT, "Accept": "application/json" },
      })
    );

    const catalogResponses = await Promise.all(catalogQueries);

    for (let i = 0; i < catalogResponses.length; i++) {
      const t = allTlds[i];
      const res = catalogResponses[i];
      try {
        const text = await res.text();
        console.log(`[domain-search] Catalog .${t} [${res.status}]:`, text.slice(0, 500));

        if (!res.ok) continue;

        const data = JSON.parse(text);
        const items = Array.isArray(data) ? data : data.data || [];

        for (const item of items) {
          // Extract price — Hostinger prices are in cents
          const prices = item.prices || [];
          // Prefer 1-year registration price
          const yearlyPrice = prices.find((p: any) =>
            p.period === 1 && (p.period_unit === "year" || p.period_unit === "years")
          );
          const bestPrice = yearlyPrice || prices[0];

          if (bestPrice) {
            const amountCents = bestPrice.price ?? bestPrice.amount ?? bestPrice.renewal_price ?? 0;
            const costEuros = amountCents / 100; // cents → euros
            const itemId = item.id || item.item_id || "";
            priceMap[t] = { costPrice: costEuros, itemId };
            console.log(`[domain-search] Price .${t}: ${costEuros}€ (${amountCents} cents), itemId: ${itemId}`);
          }
        }
      } catch (e) {
        console.warn(`[domain-search] Catalog parse error .${t}:`, e);
      }
    }

    // Fallback: bulk catalog query if per-TLD returned nothing
    if (Object.keys(priceMap).length === 0) {
      console.log("[domain-search] Per-TLD catalog empty, trying bulk DOMAIN catalog...");
      try {
      const bulkRes = await fetch(`${HOSTINGER_API_BASE}/api/billing/v1/catalog?category=DOMAIN`, {
          headers: { Authorization: `Bearer ${HOSTINGER_API_TOKEN}`, "User-Agent": USER_AGENT, "Accept": "application/json" },
        });
        const bulkText = await bulkRes.text();
        console.log(`[domain-search] Bulk catalog [${bulkRes.status}]:`, bulkText.slice(0, 2000));

        if (bulkRes.ok) {
          const bulkData = JSON.parse(bulkText);
          const items = Array.isArray(bulkData) ? bulkData : bulkData.data || [];
          for (const item of items) {
            const name = (item.name || "").toLowerCase();
            // Extract TLD from catalog item name (e.g. ".COM Registration" → "com")
            const dotMatch = name.match(/\.([a-z]{2,})/);
            if (dotMatch) {
              const itemTld = dotMatch[1];
              if (allTlds.includes(itemTld) && item.prices?.length) {
                const yearlyPrice = item.prices.find((p: any) =>
                  p.period === 1 && (p.period_unit === "year" || p.period_unit === "years")
                );
                const price = yearlyPrice || item.prices[0];
                const amountCents = price.price ?? price.amount ?? price.renewal_price ?? 0;
                priceMap[itemTld] = {
                  costPrice: amountCents / 100,
                  itemId: item.id || item.item_id || "",
                };
              }
            }
          }
        }
      } catch (e) {
        console.warn("[domain-search] Bulk catalog error:", e);
      }
    }

    console.log("[domain-search] Final priceMap:", JSON.stringify(priceMap));

    // ── 3. Build response with MARKUP ──
    const mainResult = results.find((r) => r.domain === cleanDomain);
    const mainAvailable = mainResult?.is_available ?? false;
    const mainPriceData = priceMap[tld];
    const mainCostPrice = mainPriceData?.costPrice ?? 0;
    const mainSalePrice = mainCostPrice > 0 ? applyMarkup(mainCostPrice, tld) : 0;
    const mainItemId = mainPriceData?.itemId ?? "";

    console.log(`[domain-search] Main: cost=${mainCostPrice}€, sale=${mainSalePrice}€, margin=${(mainSalePrice - mainCostPrice).toFixed(2)}€`);

    const suggestions = results
      .filter((r) => r.domain !== cleanDomain && r.is_available)
      .map((r) => {
        const rTld = r.domain.split(".").slice(1).join(".");
        const rPriceData = priceMap[rTld];
        const costPrice = rPriceData?.costPrice ?? 0;
        const salePrice = costPrice > 0 ? applyMarkup(costPrice, rTld) : 0;
        return {
          domain: r.domain,
          tld: rTld,
          available: true,
          restriction: r.restriction,
          price: salePrice,
          costPrice, // internal
          itemId: rPriceData?.itemId ?? "",
        };
      });

    const response = {
      domain: cleanDomain,
      available: mainAvailable,
      price: mainSalePrice,
      costPrice: mainCostPrice,
      tld,
      itemId: mainItemId,
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
