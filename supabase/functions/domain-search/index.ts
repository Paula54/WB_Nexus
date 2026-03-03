const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HOSTINGER_API_BASE = "https://developers.hostinger.com";

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

    // Build TLD list
    const popularTlds = ["com", "pt", "ai", "eu", "net", "io", "org", "dev", "app", "me", "xyz", "tech", "site", "co"];
    const allTlds = [tld, ...popularTlds.filter((t) => t !== tld)];

    // Run availability check and catalog fetch in parallel
    const [availRes, catalogRes] = await Promise.all([
      fetch(`${HOSTINGER_API_BASE}/api/domains/v1/availability`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ domain: sld, tlds: allTlds }),
      }),
      fetch(`${HOSTINGER_API_BASE}/api/billing/v1/catalog?category=domain_tld`, {
        headers: { Authorization: `Bearer ${HOSTINGER_API_TOKEN}` },
      }),
    ]);

    const availText = await availRes.text();
    console.log(`Availability [${availRes.status}]:`, availText.slice(0, 300));

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

    // Parse catalog for pricing
    let priceMap: Record<string, number> = {};
    try {
      const catalogText = await catalogRes.text();
      console.log(`Catalog [${catalogRes.status}]:`, catalogText.slice(0, 500));
      if (catalogRes.ok) {
        const catalogData = JSON.parse(catalogText);
        const items = Array.isArray(catalogData) ? catalogData : catalogData.data || [];
        for (const item of items) {
          // Try to extract TLD from item name/id (e.g. "hostingerpt-domain-com")
          const id = item.id || "";
          const name = item.name || "";
          // Match patterns like ".com", ".pt" in name or extract from id
          let itemTld = "";
          const nameMatch = name.match(/\.([a-z]{2,})$/i);
          const idMatch = id.match(/domain[_-]([a-z]{2,})$/i);
          if (nameMatch) itemTld = nameMatch[1].toLowerCase();
          else if (idMatch) itemTld = idMatch[1].toLowerCase();

          if (itemTld && item.prices?.length) {
            // Find yearly price in EUR, fallback to first price
            const yearlyPrice = item.prices.find((p: any) => p.period_unit === "year" && p.period === 1);
            const price = yearlyPrice || item.prices[0];
            priceMap[itemTld] = (price.price || price.amount || 0) / 100;
          }
        }
      }
    } catch (e) {
      console.warn("Catalog parse error:", e);
    }

    console.log("Price map:", JSON.stringify(priceMap));

    // Find the main domain result
    const mainResult = results.find((r) => r.domain === cleanDomain);
    const mainAvailable = mainResult?.is_available ?? false;
    const mainPrice = priceMap[tld] ?? 0;

    // Build suggestions
    const suggestions = results
      .filter((r) => r.domain !== cleanDomain && r.is_available)
      .map((r) => {
        const rTld = r.domain.split(".").slice(1).join(".");
        return {
          domain: r.domain,
          tld: rTld,
          available: true,
          restriction: r.restriction,
          price: priceMap[rTld] ?? 0,
        };
      });

    return new Response(
      JSON.stringify({
        domain: cleanDomain,
        available: mainAvailable,
        price: mainPrice,
        tld,
        suggestions,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("domain-search error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
