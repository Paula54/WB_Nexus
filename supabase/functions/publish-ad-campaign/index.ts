import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Modelo de Agência Centralizada
const AGENCY_MARKUP = 0.15; // 15% sobre o orçamento
const PRE_AUTH_DAYS = 7;    // pré-autoriza 7 dias

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Credenciais centralizadas da Agência (secrets já existentes)
    const AGENCY_AD_ACCOUNT_ID = Deno.env.get("META_ADS_ACCOUNT_ID");
    const AGENCY_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");

    if (!AGENCY_AD_ACCOUNT_ID || !AGENCY_ACCESS_TOKEN) {
      return json({
        success: false,
        error: "Conta de anúncios da agência não configurada. Contacta o suporte.",
      });
    }

    // Verifica utilizador
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) return json({ success: false, error: "Invalid token" }, 401);
    const userId = claimsData.claims.sub as string;

    const { campaign_id, project_id, ad_copy, daily_budget, target_audience } = await req.json();

    if (!project_id || !ad_copy || !daily_budget) {
      return json({ success: false, error: "Campos obrigatórios em falta." }, 400);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Valida posse do projeto
    const { data: project, error: projectError } = await adminClient
      .from("projects")
      .select("id, name")
      .eq("id", project_id)
      .eq("user_id", userId)
      .single();

    if (projectError || !project) {
      return json({ success: false, error: "Projeto não encontrado." }, 404);
    }

    // ============= VERIFICAÇÃO DE SALDO NA WALLET NEXUS =============
    const dailyBudgetNum = Number(daily_budget);
    const totalBudget = dailyBudgetNum * PRE_AUTH_DAYS;
    const serviceFee = totalBudget * AGENCY_MARKUP;
    const requiredAmount = +(totalBudget + serviceFee).toFixed(2);

    const { data: txs, error: txError } = await adminClient
      .from("wallet_transactions")
      .select("amount")
      .eq("user_id", userId);

    if (txError) {
      console.error("[publish-ad-campaign] wallet read error:", txError);
      return json({ success: false, error: "Não foi possível ler o saldo da Wallet." });
    }

    const balance = (txs || []).reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);

    if (balance < requiredAmount) {
      return json({
        success: false,
        error: `Saldo insuficiente na Wallet Nexus.`,
        requires_wallet_topup: true,
        wallet_balance: +balance.toFixed(2),
        required_amount: requiredAmount,
        missing_amount: +(requiredAmount - balance).toFixed(2),
        breakdown: {
          daily_budget: dailyBudgetNum,
          days_pre_auth: PRE_AUTH_DAYS,
          total_budget: +totalBudget.toFixed(2),
          service_fee: +serviceFee.toFixed(2),
          markup_pct: AGENCY_MARKUP * 100,
        },
        hint: `Carrega pelo menos ${(requiredAmount - balance).toFixed(2)} € na tua Wallet Nexus para publicar esta campanha.`,
      });
    }

    // ============= PUBLICAÇÃO NA CONTA CENTRAL DA AGÊNCIA =============
    const cleanAccountId = String(AGENCY_AD_ACCOUNT_ID).replace(/^act_/, "").trim();
    const accountId = `act_${cleanAccountId}`;

    // Step 1: Campaign
    const campaignParams = new URLSearchParams({
      name: `Nexus [${project.name}] - ${new Date().toISOString().split("T")[0]}`,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: "[]",
      is_adset_budget_sharing_enabled: "false",
      access_token: AGENCY_ACCESS_TOKEN,
    });

    const campaignResponse = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/campaigns`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: campaignParams.toString(),
      }
    );
    const campaignResult = await campaignResponse.json();

    if (campaignResult.error) {
      console.error("[publish-ad-campaign] Campaign error:", JSON.stringify(campaignResult.error));
      const e = campaignResult.error;
      return json({
        success: false,
        error: `Meta API: ${e.error_user_msg || e.message || "Erro ao criar campanha"}`,
        meta_error: e,
      });
    }

    const metaCampaignId = campaignResult.id;

    // Step 2: Ad Set
    const adSetParams = new URLSearchParams({
      name: `Nexus AdSet - ${target_audience || "Broad"}`,
      campaign_id: metaCampaignId,
      daily_budget: String(Math.round(dailyBudgetNum * 100)),
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: JSON.stringify({ geo_locations: { countries: ["PT"] } }),
      status: "PAUSED",
      access_token: AGENCY_ACCESS_TOKEN,
    });

    const adSetResponse = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/adsets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: adSetParams.toString(),
      }
    );
    const adSetResult = await adSetResponse.json();

    if (adSetResult.error) {
      console.error("[publish-ad-campaign] AdSet error:", JSON.stringify(adSetResult.error));
      const e = adSetResult.error;
      return json({
        success: false,
        error: `Meta API (AdSet): ${e.error_user_msg || e.message}`,
        meta_campaign_id: metaCampaignId,
        meta_error: e,
      });
    }

    // ============= DÉBITO DA WALLET (pré-autorização) =============
    const { error: debitError } = await adminClient.from("wallet_transactions").insert({
      user_id: userId,
      amount: -requiredAmount,
      type: "ad_campaign_hold",
      description: `Pré-autorização campanha Meta (7d × ${dailyBudgetNum.toFixed(2)}€ + 15% taxa de gestão)`,
      reference_id: metaCampaignId,
    });

    if (debitError) {
      console.error("[publish-ad-campaign] wallet debit error:", debitError);
      // Campanha ficou em PAUSED na Meta sem débito → ainda assim avisa
      return json({
        success: false,
        error: "Campanha criada mas não foi possível debitar a Wallet. Contacta o suporte.",
        meta_campaign_id: metaCampaignId,
      });
    }

    // Atualiza registo local
    if (campaign_id) {
      await adminClient
        .from("ads_campaigns")
        .update({
          metrics: {
            impressions: 0, clicks: 0, conversions: 0, spend: 0,
            meta_campaign_id: metaCampaignId,
            meta_adset_id: adSetResult.id || null,
            wallet_pre_auth: requiredAmount,
            service_fee: +serviceFee.toFixed(2),
          },
        })
        .eq("id", campaign_id);
    }

    return json({
      success: true,
      meta_campaign_id: metaCampaignId,
      meta_adset_id: adSetResult.id || null,
      wallet_charged: requiredAmount,
      service_fee: +serviceFee.toFixed(2),
      message: `Campanha criada! Debitámos ${requiredAmount.toFixed(2)}€ da tua Wallet Nexus (7 dias × ${dailyBudgetNum.toFixed(2)}€ + 15% taxa).`,
    });
  } catch (error) {
    console.error("[publish-ad-campaign] internal error:", error);
    return json({ success: false, error: "Erro interno ao publicar a campanha." }, 500);
  }
});
