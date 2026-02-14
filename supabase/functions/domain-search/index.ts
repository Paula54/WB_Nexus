const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PORKBUN_API_KEY = Deno.env.get("PORKBUN_API_KEY")!;
    const PORKBUN_SECRET_KEY = Deno.env.get("PORKBUN_SECRET_KEY")!;

    const { domain } = await req.json();
    if (!domain || typeof domain !== "string") {
      return new Response(
        JSON.stringify({ error: "Domínio inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean domain input
    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

    // Check pricing/availability via Porkbun API
    const pricingRes = await fetch("https://api.porkbun.com/api/json/v3/pricing/get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: PORKBUN_API_KEY,
        secretapikey: PORKBUN_SECRET_KEY,
      }),
    });
    const pricingData = await pricingRes.json();

    // Extract TLD from domain
    const parts = cleanDomain.split(".");
    const tld = parts.length >= 2 ? parts.slice(1).join(".") : "com";
    const sld = parts[0];

    // Check availability via Porkbun
    const checkRes = await fetch(`https://api.porkbun.com/api/json/v3/domain/checkAvailability/${cleanDomain}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: PORKBUN_API_KEY,
        secretapikey: PORKBUN_SECRET_KEY,
      }),
    });
    const checkData = await checkRes.json();

    const available = checkData.status === "SUCCESS" && checkData.avail === "yes";
    
    // Get cost price from pricing data
    let costPrice = 0;
    if (pricingData.pricing && pricingData.pricing[tld]) {
      costPrice = parseFloat(pricingData.pricing[tld].registration || "0");
    }

    const MARGIN = 15;
    const finalPrice = costPrice + MARGIN;

    // Also suggest alternatives with popular TLDs
    const suggestions: Array<{ domain: string; tld: string; costPrice: number; finalPrice: number }> = [];
    const popularTlds = ["com", "pt", "eu", "net", "io", "co"];

    for (const altTld of popularTlds) {
      if (altTld === tld) continue;
      if (pricingData.pricing && pricingData.pricing[altTld]) {
        const altCost = parseFloat(pricingData.pricing[altTld].registration || "0");
        suggestions.push({
          domain: `${sld}.${altTld}`,
          tld: altTld,
          costPrice: altCost,
          finalPrice: altCost + MARGIN,
        });
      }
    }

    return new Response(
      JSON.stringify({
        domain: cleanDomain,
        available,
        costPrice,
        finalPrice,
        tld,
        suggestions: suggestions.slice(0, 5),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("domain-search error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
