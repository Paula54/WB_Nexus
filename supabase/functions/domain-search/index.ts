const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TLD_PRICES: Record<string, number> = {
  com: 11.08, net: 12.52, org: 11.08, pt: 15.00, eu: 5.46,
  io: 28.12, co: 9.58, dev: 13.52, app: 14.52, me: 5.08,
  xyz: 1.08, info: 2.58, biz: 2.58, tech: 3.08, site: 1.08,
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
    if (text.startsWith("{") || text.startsWith("[")) {
      const data = JSON.parse(text);
      return data.status === "SUCCESS" && data.avail === "yes";
    }
    return false;
  } catch {
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

    // Check main domain + all suggestions in parallel (all free API calls)
    const popularTlds = ["com", "pt", "eu", "net", "io", "co"];
    const suggestionTlds = popularTlds.filter((t) => t !== tld);
    const suggestionDomains = suggestionTlds.map((t) => `${sld}.${t}`);

    const [mainAvailable, ...suggestionResults] = await Promise.all([
      checkAvailability(cleanDomain, PORKBUN_API_KEY, PORKBUN_SECRET_KEY),
      ...suggestionDomains.map((d) => checkAvailability(d, PORKBUN_API_KEY, PORKBUN_SECRET_KEY)),
    ]);

    const costPrice = TLD_PRICES[tld] || DEFAULT_PRICE;
    const finalPrice = Math.round((costPrice + MARGIN) * 100) / 100;

    const suggestions = suggestionTlds.map((t, i) => {
      const c = TLD_PRICES[t] || DEFAULT_PRICE;
      return {
        domain: `${sld}.${t}`,
        tld: t,
        costPrice: c,
        finalPrice: Math.round((c + MARGIN) * 100) / 100,
        available: suggestionResults[i],
      };
    });

    return new Response(
      JSON.stringify({ domain: cleanDomain, available: mainAvailable, costPrice, finalPrice, tld, suggestions }),
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
