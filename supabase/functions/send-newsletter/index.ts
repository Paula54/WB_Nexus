import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { renderEmailTemplate, type BrandData } from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FROM_ADDR = "Nexus Machine <newsletter@send.web-business.pt>";

function unsubToken(userId: string, email: string): string {
  return btoa(`${userId}|${email}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const campaign_id: string = body.campaign_id;
    const test_email: string | undefined = body.test_email;
    const segment_tags: string[] = Array.isArray(body.segment_tags) ? body.segment_tags : [];
    const isTest = !!test_email;

    // Fetch campaign
    const { data: campaign, error: campErr } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campanha não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch brand data (business_profiles)
    const { data: bp } = await supabase
      .from("business_profiles")
      .select("trade_name,legal_name,logo_url,facebook_url,instagram_url,linkedin_url,website,email,address_line1,city,postal_code")
      .eq("user_id", user.id)
      .maybeSingle();

    const brand: BrandData = bp || {};
    const projectUrl = Deno.env.get("SUPABASE_URL")!;

    // ----- TEST SEND -----
    if (isTest) {
      const unsubUrl = `${projectUrl}/functions/v1/unsubscribe?token=${unsubToken(user.id, test_email!)}`;
      const renderedHtml = renderEmailTemplate({
        subject: campaign.subject,
        contentHtml: campaign.content,
        brand,
        unsubscribeUrl: unsubUrl,
        preheader: `Pré-visualização: ${campaign.subject}`,
      });

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_ADDR,
          to: [test_email],
          subject: `[TESTE] ${campaign.subject}`,
          html: renderedHtml,
        }),
      });
      const rd = await resendRes.json();
      if (!resendRes.ok) {
        console.error("Resend test error:", rd);
        return new Response(JSON.stringify({ error: "Erro ao enviar teste", details: rd }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, message: "Email de teste enviado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- REAL CAMPAIGN -----
    const { data: profile } = await supabase
      .from("profiles")
      .select("email_sends_used, email_sends_limit")
      .eq("user_id", user.id)
      .maybeSingle();

    const used = profile?.email_sends_used ?? 0;
    const limit = profile?.email_sends_limit ?? 500;

    // Build subscriber query with tag segmentation
    let q = supabase
      .from("subscribers")
      .select("email,name,tags")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (segment_tags.length > 0) {
      q = q.overlaps("tags", segment_tags);
    }

    const { data: subscribers, error: subErr } = await q;

    if (subErr || !subscribers?.length) {
      return new Response(JSON.stringify({ error: "Sem subscritores ativos para o segmento escolhido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remaining = limit - used;
    if (remaining <= 0) {
      return new Response(JSON.stringify({ error: "Limite mensal de envios atingido. Faz upgrade do teu Pack." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toSend = subscribers.slice(0, remaining);
    let sentCount = 0;

    // Send one-by-one so each gets a unique unsubscribe link
    for (const sub of toSend) {
      const unsubUrl = `${projectUrl}/functions/v1/unsubscribe?token=${unsubToken(user.id, sub.email)}`;
      const renderedHtml = renderEmailTemplate({
        subject: campaign.subject,
        contentHtml: campaign.content,
        brand,
        unsubscribeUrl: unsubUrl,
      });

      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM_ADDR,
            to: [sub.email],
            subject: campaign.subject,
            html: renderedHtml,
            headers: {
              "List-Unsubscribe": `<${unsubUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }),
        });
        if (r.ok) sentCount++;
        else console.error(`Send to ${sub.email} failed:`, await r.text());
      } catch (e) {
        console.error(`Send to ${sub.email} threw:`, e);
      }
    }

    await supabase
      .from("email_campaigns")
      .update({ status: "sent", sent_count: sentCount, sent_at: new Date().toISOString() })
      .eq("id", campaign_id);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await adminClient
      .from("profiles")
      .update({ email_sends_used: used + sentCount })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ success: true, sent_count: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-newsletter] internal error:", e);
    return new Response(JSON.stringify({ error: "Ocorreu um erro interno ao enviar a newsletter." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
