import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { campaign_id, test_email } = await req.json();
    const isTest = !!test_email;

    // Fetch campaign
    const { data: campaign, error: campErr } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .eq("user_id", user.id)
      .single();

    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campanha não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For test sends, just send to the test email
    if (isTest) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Nexus Machine <newsletter@send.web-business.pt>",
          to: [test_email],
          subject: `[TESTE] ${campaign.subject}`,
          html: campaign.content,
        }),
      });
      const resendData = await resendRes.json();
      console.log("Resend test response:", JSON.stringify(resendData), "status:", resendRes.status);
      if (!resendRes.ok) {
        return new Response(JSON.stringify({ error: "Erro ao enviar teste", details: resendData }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, message: "Email de teste enviado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check pack limits
    const { data: profile } = await supabase
      .from("profiles")
      .select("email_sends_used, email_sends_limit")
      .eq("user_id", user.id)
      .single();

    const used = profile?.email_sends_used ?? 0;
    const limit = profile?.email_sends_limit ?? 500;

    // Fetch active subscribers
    const { data: subscribers, error: subErr } = await supabase
      .from("subscribers")
      .select("email, name")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (subErr || !subscribers?.length) {
      return new Response(JSON.stringify({ error: "Sem subscritores ativos" }), {
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

    // Send in batches of 50
    for (let i = 0; i < toSend.length; i += 50) {
      const batch = toSend.slice(i, i + 50);
      const emails = batch.map((s) => s.email);

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Nexus Machine <newsletter@send.web-business.pt>",
          to: emails,
          subject: campaign.subject,
          html: campaign.content,
        }),
      });

      if (resendRes.ok) {
        sentCount += emails.length;
      } else {
        const errBody = await resendRes.text();
        console.error(`Batch ${i} failed:`, errBody);
      }
    }

    // Update campaign status
    await supabase
      .from("email_campaigns")
      .update({ status: "sent", sent_count: sentCount, sent_at: new Date().toISOString() })
      .eq("id", campaign_id);

    // Increment usage using service role
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
