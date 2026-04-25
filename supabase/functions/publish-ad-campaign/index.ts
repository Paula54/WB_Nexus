import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/crypto.ts";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub;

    const { campaign_id, project_id, ad_copy, daily_budget, target_audience } = await req.json();

    if (!project_id || !ad_copy) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify project ownership
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: project, error: projectError } = await adminClient
      .from("projects")
      .select("id")
      .eq("id", project_id)
      .eq("user_id", userId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ success: false, error: "Projeto não encontrado ou sem permissão" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Meta credentials from project_credentials
    const { data: creds } = await adminClient
      .from("project_credentials")
      .select("meta_ads_account_id, meta_access_token, facebook_page_id")
      .eq("project_id", project_id)
      .single();

    if (!creds) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais não encontradas." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { meta_ads_account_id, facebook_page_id } = creds;

    if (!meta_ads_account_id || !creds.meta_access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Meta Ads não está conectado. Conecta a API primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!facebook_page_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhuma Página de Facebook selecionada. Configura nas definições." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt the user (long-lived) access token — used for campaign/adset creation
    const meta_access_token = await decryptToken(creds.meta_access_token);

    // Fetch a fresh PAGE access token (required for ad creatives that reference a page)
    let page_access_token: string | null = null;
    try {
      // 1) Try meta_connections.page_access_token (encrypted)
      const { data: metaConn } = await adminClient
        .from("meta_connections")
        .select("page_access_token")
        .eq("project_id", project_id)
        .maybeSingle();
      if (metaConn?.page_access_token) {
        try {
          page_access_token = await decryptToken(metaConn.page_access_token);
        } catch (_) {
          page_access_token = null;
        }
      }
    } catch (_) { /* table may be missing in cache; continue */ }

    // 2) Fallback: fetch directly from Graph API using the user token
    if (!page_access_token) {
      try {
        const pageRes = await fetch(
          `https://graph.facebook.com/v21.0/${facebook_page_id}?fields=access_token&access_token=${encodeURIComponent(meta_access_token)}`
        );
        const pageJson = await pageRes.json();
        if (pageJson?.access_token) {
          page_access_token = pageJson.access_token;
        } else if (pageJson?.error) {
          console.error("[publish-ad-campaign] page token fetch error:", JSON.stringify(pageJson.error));
          const e = pageJson.error;
          return new Response(
            JSON.stringify({
              success: false,
              error: `Meta API: ${e.error_user_msg || e.message || "Página: o token não é válido"}`,
              meta_error: e,
              hint: "O token expirou ou perdeste permissões da Página. Vai a Definições → Liga novamente o Facebook e aceita TODAS as permissões (pages_show_list, pages_manage_posts, pages_read_engagement, ads_management).",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        console.error("[publish-ad-campaign] page token fetch exception:", e);
      }
    }

    if (!page_access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Página nº ${facebook_page_id}: o token não é válido ou está em falta.`,
          hint: "Vai a Definições → Redes Sociais e liga novamente o Facebook, aceitando TODAS as permissões.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize account_id: strip "act_" if present, then re-add (Meta requires exactly one)
    const cleanAccountId = String(meta_ads_account_id).replace(/^act_/, "").trim();
    const accountId = `act_${cleanAccountId}`;

    if (!/^act_\d+$/.test(accountId)) {
      return new Response(
        JSON.stringify({ success: false, error: `ID de conta Meta inválido: "${meta_ads_account_id}". Deve ser numérico.` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[publish-ad-campaign] Creating campaign on account:", accountId);

    // Pre-check: verify Ad Account has a funding source (payment method) configured
    try {
      const acctRes = await fetch(
        `https://graph.facebook.com/v21.0/${accountId}?fields=funding_source,account_status,currency,disable_reason&access_token=${encodeURIComponent(meta_access_token)}`
      );
      const acctJson = await acctRes.json();
      if (acctJson?.error) {
        const e = acctJson.error;
        return new Response(
          JSON.stringify({
            success: false,
            error: `Meta API: ${e.error_user_msg || e.message || "Não foi possível ler a Conta de Anúncios"}`,
            meta_error: e,
            hint: "Verifica se o token tem 'ads_management' e 'ads_read' e se tens acesso a esta Ad Account.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // account_status: 1 = ACTIVE; anything else means not usable
      if (acctJson.account_status && acctJson.account_status !== 1) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `A Conta de Anúncios Meta não está ativa (status ${acctJson.account_status}).`,
            requires_payment_setup: true,
            payment_setup_url: `https://business.facebook.com/billing_hub/payment_settings?asset_id=${cleanAccountId}`,
            hint: "Abre o Meta Business Suite → Centro de Faturação e ativa/configura a conta antes de publicar.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!acctJson.funding_source) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "A tua Conta de Anúncios Meta não tem método de pagamento configurado.",
            requires_payment_setup: true,
            payment_setup_url: `https://business.facebook.com/billing_hub/payment_settings?asset_id=${cleanAccountId}`,
            hint: "Adiciona um cartão ou outro método de pagamento na Meta antes de publicar a campanha.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (e) {
      console.warn("[publish-ad-campaign] funding_source check failed (continuing):", e);
    }

    // Step 1: Create Campaign — use form-encoded body (Meta API preference) and OUTCOME_TRAFFIC
    const campaignParams = new URLSearchParams({
      name: `Nexus Campaign - ${new Date().toISOString().split("T")[0]}`,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: "[]",
      is_adset_budget_sharing_enabled: "false",
      access_token: meta_access_token,
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
      console.error("[publish-ad-campaign] Meta Campaign Error:", JSON.stringify(campaignResult.error));
      const err = campaignResult.error;
      const detail = err.error_user_msg || err.error_user_title || err.message || "Erro desconhecido";
      return new Response(
        JSON.stringify({
          success: false,
          error: `Meta API: ${detail}`,
          meta_error: err,
          hint: err.code === 100
            ? "Verifica se o Ad Account está ativo e se o token tem a permissão 'ads_management'."
            : undefined,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metaCampaignId = campaignResult.id;

    // Step 2: Create Ad Set (form-encoded, with promoted page_id required by OUTCOME_TRAFFIC)
    const adSetParams = new URLSearchParams({
      name: `Nexus AdSet - ${target_audience || "Broad"}`,
      campaign_id: metaCampaignId,
      daily_budget: String(Math.round((daily_budget || 5) * 100)),
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: JSON.stringify({ geo_locations: { countries: ["PT"] } }),
      promoted_object: JSON.stringify({ page_id: facebook_page_id }),
      status: "PAUSED",
      access_token: meta_access_token,
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
      console.error("[publish-ad-campaign] Meta AdSet Error:", JSON.stringify(adSetResult.error));
      const err = adSetResult.error;
      const detail = err.error_user_msg || err.error_user_title || err.message || "Erro desconhecido";
      return new Response(
        JSON.stringify({ success: false, error: `Meta API (AdSet): ${detail}`, meta_campaign_id: metaCampaignId, meta_error: err }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Create Ad Creative
    const creativeResponse = await fetch(
      `https://graph.facebook.com/v21.0/${accountId}/adcreatives`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Nexus Creative - ${new Date().toISOString().split("T")[0]}`,
          object_story_spec: {
            page_id: facebook_page_id,
            link_data: {
              message: ad_copy,
              link: "https://example.com",
              call_to_action: { type: "LEARN_MORE" },
            },
          },
          access_token: page_access_token,
        }),
      }
    );

    const creativeResult = await creativeResponse.json();

    if (creativeResult.error) {
      console.error("[publish-ad-campaign] Meta Creative Error:", JSON.stringify(creativeResult.error));
      const err = creativeResult.error;
      const detail = err.error_user_msg || err.error_user_title || err.message || "Erro desconhecido";
      return new Response(
        JSON.stringify({
          success: false,
          error: `Meta API (Creative): ${detail}`,
          meta_campaign_id: metaCampaignId,
          meta_adset_id: adSetResult.id || null,
          meta_error: err,
          hint: "Se diz que o token da página não é válido, vai a Definições e liga novamente o Facebook aceitando todas as permissões.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the local campaign with Meta IDs
    if (campaign_id) {
      await adminClient
        .from("ads_campaigns")
        .update({
          metrics: {
            impressions: 0, clicks: 0, conversions: 0, spend: 0,
            meta_campaign_id: metaCampaignId,
            meta_adset_id: adSetResult.id || null,
            meta_creative_id: creativeResult.id || null,
          },
        })
        .eq("id", campaign_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        meta_campaign_id: metaCampaignId,
        meta_adset_id: adSetResult.id || null,
        meta_creative_id: creativeResult.id || null,
        message: "Campanha criada na Meta Ads com sucesso!",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[publish-ad-campaign] internal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Ocorreu um erro interno ao publicar a campanha." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
