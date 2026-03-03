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

    // Check availability via Hostinger API with alternatives
    const popularTlds = ["com", "pt", "ai", "eu", "net", "io", "org", "dev", "app", "me", "xyz", "tech", "site", "co"];
    // Include the searched TLD + popular ones
    const allTlds = [tld, ...popularTlds.filter((t) => t !== tld)];

    const res = await fetch(`${HOSTINGER_API_BASE}/api/domains/v1/availability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HOSTINGER_API_TOKEN}`,
      },
      body: JSON.stringify({
        domain: sld,
        tlds: allTlds,
        with_alternatives: true,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Hostinger API error [${res.status}]:`, errorText);
      throw new Error(`Hostinger API error: ${res.status}`);
    }

    const data = await res.json();
    console.log("Hostinger response:", JSON.stringify(data));

    // Parse Hostinger response - it returns an array of results
    // Each item: { domain, tld, is_available, purchase_price (object with amount, currency, period) }
    const results: Array<{
      domain: string;
      tld: string;
      is_available: boolean;
      purchase_price?: { amount: number; currency: string; period: number };
    }> = Array.isArray(data) ? data : data.results || data.data || [];

    // Find the main domain result
    const mainResult = results.find(
      (r) => r.tld === tld || r.domain === `${sld}.${tld}` || r.domain === cleanDomain
    );

    const mainAvailable = mainResult?.is_available ?? false;
    const mainPrice = mainResult?.purchase_price?.amount ?? 0;

    // Build suggestions from the remaining TLDs
    const suggestions = results
      .filter((r) => {
        const rTld = r.tld || r.domain?.split(".").slice(1).join(".");
        return rTld !== tld;
      })
      .map((r) => {
        const rTld = r.tld || r.domain?.split(".").slice(1).join(".");
        const rDomain = r.domain || `${sld}.${rTld}`;
        const price = r.purchase_price?.amount ?? 0;
        return {
          domain: rDomain,
          tld: rTld,
          price,
          available: r.is_available,
        };
      })
      .filter((s) => s.available);

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
