import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HOSTINGER_API_BASE = "https://developers.hostinger.com";
const USER_AGENT = "NexusMachine/1.0 (Domain Reseller; contact@web-business.pt)";

// ── Markup / Profit Rules (must match domain-search) ──
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const HOSTINGER_API_TOKEN = Deno.env.get("HOSTINGER_API_TOKEN");

    if (!HOSTINGER_API_TOKEN) {
      throw new Error("HOSTINGER_API_TOKEN not configured");
    }

    // ── Auth ──
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { domain, price, itemId } = await req.json();

    if (!domain || !price) {
      return new Response(
        JSON.stringify({ error: "Dados em falta (domain, price)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tld = domain.includes(".") ? domain.split(".").slice(1).join(".") : "com";
    const salePrice = price;

    console.log(`[domain-register] User ${user.id} requesting: ${domain}, sale: ${salePrice}€, itemId: ${itemId || "auto"}`);

    // ── 1. Verify wallet balance ──
    const { data: transactions } = await adminClient
      .from("wallet_transactions")
      .select("amount")
      .eq("user_id", user.id);

    const balance = (transactions || []).reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);

    if (balance < price) {
      return new Response(
        JSON.stringify({ error: "Saldo insuficiente na Wallet", balance, required: price }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Get registrant data from profiles + business_profiles ──
    const [profileRes, businessRes] = await Promise.all([
      adminClient.from("profiles").select("full_name, contact_email").eq("user_id", user.id).maybeSingle(),
      adminClient.from("business_profiles").select("business_name, legal_name, address_line1, city, postal_code, country, nif").eq("user_id", user.id).maybeSingle(),
    ]);

    const profile = profileRes.data;
    const business = businessRes.data;

    const registrantName = business?.legal_name || business?.business_name || profile?.full_name || user.email?.split("@")[0] || "Domain Owner";
    const registrantEmail = profile?.contact_email || user.email || "";
    const registrantPhone = "+351000000000";
    const registrantAddress = business?.address_line1 || "Rua Exemplo 1";
    const registrantCity = business?.city || "Lisboa";
    const registrantZip = business?.postal_code || "1000-001";
    const registrantCountry = (business?.country === "Portugal" ? "PT" : business?.country) || "PT";

    console.log(`[domain-register] Registrant: ${registrantName}, ${registrantEmail}`);

    // ── 3. Get catalog item_id if not provided ──
    let catalogItemId = itemId || null;

    if (!catalogItemId) {
      console.log(`[domain-register] No itemId provided, fetching from catalog for .${tld}...`);
      const catalogRes = await fetch(
        `${HOSTINGER_API_BASE}/api/billing/v1/catalog?category=DOMAIN&name=.${tld.toUpperCase()}*`,
        { headers: { Authorization: `Bearer ${HOSTINGER_API_TOKEN}`, "User-Agent": USER_AGENT, "Accept": "application/json" } }
      );

      if (catalogRes.ok) {
        const catalogData = await catalogRes.json();
        console.log(`[domain-register] Catalog .${tld}:`, JSON.stringify(catalogData).slice(0, 500));

        const items = Array.isArray(catalogData) ? catalogData : catalogData.data || [];
        if (items.length > 0) {
          // Pick first matching registration item
          const match = items.find((item: any) =>
            (item.name || "").toLowerCase().includes(tld.toLowerCase())
          );
          catalogItemId = (match || items[0]).id || (match || items[0]).item_id;
        }
      } else {
        console.error(`[domain-register] Catalog fetch failed [${catalogRes.status}]:`, await catalogRes.text());
      }
    }

    if (!catalogItemId) {
      return new Response(
        JSON.stringify({ error: `Não foi possível encontrar o item de catálogo para .${tld}. Contacta o suporte.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[domain-register] Using itemId: ${catalogItemId}`);

    // ── 4. Purchase domain (POST /api/domains/v1/portfolio) ──
    // Official Hostinger API: { domain, item_id, domain_contacts: { owner: {...} } }
    const purchaseBody = {
      domain,
      item_id: catalogItemId,
      domain_contacts: {
        owner: {
          first_name: registrantName.split(" ")[0],
          last_name: registrantName.split(" ").slice(1).join(" ") || registrantName.split(" ")[0],
          email: registrantEmail,
          phone: registrantPhone,
          address: registrantAddress,
          city: registrantCity,
          zip: registrantZip,
          country: registrantCountry,
          company: business?.legal_name || "",
        },
      },
    };

    console.log(`[domain-register] Purchase body:`, JSON.stringify(purchaseBody));

    let registerRes: Response | null = null;
    let registerText = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      registerRes = await fetch(`${HOSTINGER_API_BASE}/api/domains/v1/portfolio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${HOSTINGER_API_TOKEN}`,
          "User-Agent": USER_AGENT,
          "Accept": "application/json",
        },
        body: JSON.stringify(purchaseBody),
      });
      registerText = await registerRes.text();
      console.log(`[domain-register] Hostinger attempt ${attempt} [${registerRes.status}]:`, registerText.slice(0, 500));
      if (registerRes.ok || (registerRes.status !== 503 && registerRes.status !== 429)) break;
      if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 2000));
    }

    if (!registerRes || !registerRes.ok) {
      throw new Error(`Erro Hostinger (${registerRes.status}): ${registerText}`);
    }

    let registerData: any = {};
    try {
      registerData = JSON.parse(registerText);
    } catch {
      console.log("[domain-register] Response is not JSON, proceeding with defaults");
    }

    // ── 5. Debit wallet ──
    await adminClient.from("wallet_transactions").insert({
      user_id: user.id,
      amount: -salePrice,
      type: "domain_purchase",
      description: `Registo de domínio: ${domain}`,
      reference_id: domain,
    });

    // ── 6. Save to domain_registrations (sale + cost for profit tracking) ──
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const rule = MARKUP_RULES[tld.toLowerCase()] || DEFAULT_MARKUP;
    const estimatedCost = Math.max(0, (salePrice - rule.fixed) / (1 + rule.percent));

    console.log(`[domain-register] Profit: sale=${salePrice}€, estCost=${estimatedCost.toFixed(2)}€, profit=${(salePrice - estimatedCost).toFixed(2)}€`);

    await adminClient.from("domain_registrations").insert({
      user_id: user.id,
      domain_name: domain,
      status: "active",
      purchase_price: salePrice,
      cost_price: parseFloat(estimatedCost.toFixed(2)),
      porkbun_id: registerData.id || `hostinger-${Date.now()}`,
      nameservers: registerData.nameservers || ["ns1.hostinger.com", "ns2.hostinger.com"],
      expiry_date: registerData.expiry_date || expiryDate.toISOString(),
    });

    // ── 7. Upsert project ──
    const { data: existingProject } = await adminClient
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .eq("domain", domain)
      .maybeSingle();

    if (existingProject) {
      await adminClient
        .from("projects")
        .update({ domain, updated_at: new Date().toISOString() })
        .eq("id", existingProject.id);
    } else {
      await adminClient.from("projects").insert({
        user_id: user.id,
        name: domain.split(".")[0],
        domain,
        project_type: "website",
      });
    }

    console.log(`[domain-register] Success! Domain ${domain} registered for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        domain,
        message: `Domínio ${domain} registado com sucesso!`,
        newBalance: balance - salePrice,
        redirect: "https://nexus.web-business.pt/dashboard",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[domain-register] error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
