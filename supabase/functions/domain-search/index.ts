const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TLD_PRICES: Record<string, number> = {
  com: 11.08, net: 12.52, org: 11.08, pt: 15.00, eu: 5.46,
  io: 28.12, co: 9.58, dev: 13.52, app: 14.52, me: 5.08,
  xyz: 1.08, info: 2.58, biz: 2.58, tech: 3.08, site: 1.08,
  ai: 55.00,
};
const DEFAULT_PRICE = 12.00;
const MARGIN = 15;

async function checkAvailability(domain: string, apiKey: string, secretKey: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.porkbun.com/api/json/v3/domain/checkDomain/${domain}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: apiKey, secretapikey: secretKey }),
    });
    const text = await res.text();
    console.log(`[checkAvailability] ${domain} response:`, text);
    if (text.startsWith("{") || text.startsWith("[")) {
      const data = JSON.parse(text);
      // Porkbun: if status is SUCCESS and there's a price, it's available
      // Only unavailable if avail is explicitly "no" or status is not SUCCESS
      if (data.status === "SUCCESS") {
        // If avail field exists, trust it; otherwise if price exists, it's available
        if (data.avail === "no") return false;
        return true;
      }
      return false;
    }
    return false;
  } catch (e) {
    console.error(`[checkAvailability] ${domain} error:`, e);
    return false;
  }
}
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

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const parts = cleanDomain.split(".");
    const tld = parts.length >= 2 ? parts.slice(1).join(".") : "com";
    const sld = parts[0];

    // Only check main domain availability (Porkbun rate limits to 1 check per 10s)
    const mainAvailable = await checkAvailability(cleanDomain, PORKBUN_API_KEY, PORKBUN_SECRET_KEY);

    const popularTlds = ["com", "pt", "ai", "eu", "net", "io"];
    const suggestionTlds = popularTlds.filter((t) => t !== tld);

    const costPrice = TLD_PRICES[tld] || DEFAULT_PRICE;
    const finalPrice = Math.round((costPrice + MARGIN) * 100) / 100;

    // Suggestions: availability unknown (not checked due to rate limit), show as available with price
    const suggestions = suggestionTlds.map((t) => {
      const c = TLD_PRICES[t] || DEFAULT_PRICE;
      return {
        domain: `${sld}.${t}`,
        tld: t,
        costPrice: c,
        finalPrice: Math.round((c + MARGIN) * 100) / 100,
        available: true, // Assume available; purchase will validate
      };
    });

    return new Response(
      JSON.stringify({ domain: cleanDomain, available: mainAvailable, costPrice, finalPrice, tld, suggestions }),
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
