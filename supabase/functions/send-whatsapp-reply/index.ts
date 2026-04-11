import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const { leadId, message, phone } = await req.json();

    if (!message || !phone) {
      return new Response(
        JSON.stringify({ error: "Message and phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify lead belongs to authenticated user
    if (leadId) {
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("id")
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();

      if (leadError || !lead) {
        return new Response(
          JSON.stringify({ error: "Lead not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Pull whatsapp_phone_number_id dynamically from the user's project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("whatsapp_phone_number_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (projectError) {
      console.error("Error fetching project:", projectError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch project configuration", details: projectError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneNumberId = project?.whatsapp_phone_number_id;
    if (!phoneNumberId) {
      return new Response(
        JSON.stringify({ error: "WhatsApp Phone Number ID not configured in project. Please add it in Settings." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use META_ACCESS_TOKEN from secrets
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
    if (!WHATSAPP_ACCESS_TOKEN) {
      console.error("META_ACCESS_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "META_ACCESS_TOKEN not configured in secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone: remove spaces, ensure country code, remove '+'
    let cleanPhone = phone.replace(/[\s\-()]/g, "");
    if (cleanPhone.startsWith("+")) cleanPhone = cleanPhone.substring(1);
    if (!cleanPhone.startsWith("351") && cleanPhone.startsWith("9")) {
      cleanPhone = "351" + cleanPhone;
    }

    console.log(`Sending WhatsApp message to ${cleanPhone} via Meta Cloud API (Phone ID: ${phoneNumberId}) by user ${userId}`);

    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok || metaResult.error) {
      console.error("Meta WhatsApp API error:", JSON.stringify(metaResult));
      return new Response(
        JSON.stringify({
          error: "Failed to send WhatsApp message via Meta API",
          details: metaResult.error?.message || JSON.stringify(metaResult),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageId = metaResult.messages?.[0]?.id;
    console.log("WhatsApp message sent successfully via Meta API:", messageId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId,
        leadId,
        provider: "meta_cloud_api",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[send-whatsapp-reply] internal error:", error);
    return new Response(
      JSON.stringify({ error: "Ocorreu um erro interno ao enviar a mensagem." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
