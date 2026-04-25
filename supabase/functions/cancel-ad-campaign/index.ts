import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRE_AUTH_DAYS = 7;
const AGENCY_MARKUP = 0.15;

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
    const AGENCY_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");

    if (!AGENCY_ACCESS_TOKEN) {
      return json({ success: false, error: "Configuração de agência em falta." });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) return json({ success: false, error: "Invalid token" }, 401);
    const userId = claimsData.claims.sub as string;

    const { campaign_id, reason } = await req.json();
    if (!campaign_id) return json({ success: false, error: "campaign_id obrigatório." }, 400);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Carrega campanha e valida posse
    const { data: campaign, error: campaignErr } = await adminClient
      .from("ads_campaigns")
      .select("id, user_id, status, metrics")
      .eq("id", campaign_id)
      .eq("user_id", userId)
      .single();

    if (campaignErr || !campaign) return json({ success: false, error: "Campanha não encontrada." }, 404);

    if (campaign.status === "cancelled" || campaign.status === "refunded") {
      return json({ success: false, error: "Campanha já foi cancelada." });
    }

    const metrics = (campaign.metrics || {}) as Record<string, unknown>;
    const metaCampaignId = metrics.meta_campaign_id as string | undefined;
    const preAuth = Number(metrics.wallet_pre_auth || 0);
    const dailyBudget = Number(metrics.daily_budget || 0);
    const holdStartedAt = metrics.hold_started_at as string | undefined;

    // 1) Pausa a campanha na Meta (conta central da agência)
    if (metaCampaignId) {
      const pauseRes = await fetch(
        `https://graph.facebook.com/v21.0/${metaCampaignId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            status: "PAUSED",
            access_token: AGENCY_ACCESS_TOKEN,
          }).toString(),
        }
      );
      const pauseJson = await pauseRes.json();
      if (pauseJson.error) {
        console.error("[cancel-ad-campaign] Meta pause error:", pauseJson.error);
        // Continuamos para o reembolso mesmo assim — campanha pode já estar pausada
      }
    }

    // 2) Calcula reembolso proporcional
    // Dias decorridos desde o hold * (budget + markup) já é gasto considerado.
    // Restante volta para a Wallet (excluindo a taxa Stripe que já foi consumida pelo gateway).
    const startMs = holdStartedAt ? new Date(holdStartedAt).getTime() : Date.now();
    const elapsedDays = Math.min(
      PRE_AUTH_DAYS,
      Math.max(0, (Date.now() - startMs) / (1000 * 60 * 60 * 24))
    );
    const consumed = +(dailyBudget * elapsedDays * (1 + AGENCY_MARKUP)).toFixed(2);
    // Stripe fee é não-reembolsável (já cobrada pelo gateway)
    const stripeFeeNonRefundable = +((preAuth - dailyBudget * PRE_AUTH_DAYS * (1 + AGENCY_MARKUP))).toFixed(2);
    const refundAmount = Math.max(0, +(preAuth - consumed - Math.max(0, stripeFeeNonRefundable)).toFixed(2));

    // 3) Insere transação de reembolso (se houver valor a devolver)
    if (refundAmount > 0) {
      const { error: refundErr } = await adminClient.from("wallet_transactions").insert({
        user_id: userId,
        amount: refundAmount,
        type: "ad_campaign_refund",
        description: `Reembolso campanha Meta (${elapsedDays.toFixed(1)}d usados de ${PRE_AUTH_DAYS}d). ${reason ? `Motivo: ${reason}` : ""}`,
        reference_id: metaCampaignId || campaign_id,
      });
      if (refundErr) {
        console.error("[cancel-ad-campaign] refund insert error:", refundErr);
        return json({ success: false, error: "Não foi possível processar o reembolso." });
      }
    }

    // 4) Atualiza estado da campanha
    await adminClient
      .from("ads_campaigns")
      .update({
        status: "cancelled",
        end_date: new Date().toISOString(),
        metrics: {
          ...metrics,
          cancelled_at: new Date().toISOString(),
          cancel_reason: reason || null,
          consumed_amount: consumed,
          refund_amount: refundAmount,
          stripe_fee_non_refundable: Math.max(0, stripeFeeNonRefundable),
        },
      })
      .eq("id", campaign_id);

    return json({
      success: true,
      cancelled: true,
      refunded: refundAmount,
      consumed,
      elapsed_days: +elapsedDays.toFixed(2),
      message: refundAmount > 0
        ? `Campanha cancelada. Reembolsámos ${refundAmount.toFixed(2)}€ à tua Wallet Nexus.`
        : `Campanha cancelada. Não há valor a reembolsar (período já consumido).`,
    });
  } catch (error) {
    console.error("[cancel-ad-campaign] internal error:", error);
    return json({ success: false, error: "Erro interno ao cancelar a campanha." }, 500);
  }
});
