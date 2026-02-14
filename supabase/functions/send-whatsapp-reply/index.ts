import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { leadId, message, phone } = await req.json();

    if (!message || !phone) {
      return new Response(
        JSON.stringify({ error: "Message and phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (!WHATSAPP_ACCESS_TOKEN) {
      console.error("WhatsApp access token not configured");
      return new Response(
        JSON.stringify({ error: "WhatsApp access token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no Phone Number ID stored, discover it from the WABA
    let phoneNumberId = WHATSAPP_PHONE_NUMBER_ID;

    if (!phoneNumberId) {
      console.log("Discovering Phone Number ID from Meta API...");
      
      // First, get the WABA ID from shared phone numbers
      const wabaDiscovery = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${WHATSAPP_ACCESS_TOKEN}`,
        { headers: { "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
      );
      
      // Try to get WABA directly from business account
      const businessRes = await fetch(
        `https://graph.facebook.com/v21.0/me/businesses`,
        { headers: { "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
      );
      const businessData = await businessRes.json();
      console.log("Business accounts:", JSON.stringify(businessData));

      // Try finding WABA through the business
      if (businessData.data && businessData.data.length > 0) {
        const businessId = businessData.data[0].id;
        const wabaRes = await fetch(
          `https://graph.facebook.com/v21.0/${businessId}/owned_whatsapp_business_accounts`,
          { headers: { "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
        );
        const wabaData = await wabaRes.json();
        console.log("WABA data:", JSON.stringify(wabaData));

        if (wabaData.data && wabaData.data.length > 0) {
          const wabaId = wabaData.data[0].id;
          
          // Get phone numbers from WABA
          const phonesRes = await fetch(
            `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers`,
            { headers: { "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
          );
          const phonesData = await phonesRes.json();
          console.log("Phone numbers:", JSON.stringify(phonesData));

          if (phonesData.data && phonesData.data.length > 0) {
            phoneNumberId = phonesData.data[0].id;
            console.log("Discovered Phone Number ID:", phoneNumberId);
          }
        }
      }

      if (!phoneNumberId) {
        return new Response(
          JSON.stringify({ 
            error: "Could not discover Phone Number ID. Please set WHATSAPP_PHONE_NUMBER_ID secret.",
            businessData 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Format phone: remove spaces, ensure country code, remove '+'
    let cleanPhone = phone.replace(/[\s\-()]/g, "");
    if (cleanPhone.startsWith("+")) cleanPhone = cleanPhone.substring(1);
    if (!cleanPhone.startsWith("351") && cleanPhone.startsWith("9")) {
      cleanPhone = "351" + cleanPhone;
    }

    console.log(`Sending WhatsApp message to ${cleanPhone} via Meta Cloud API (Phone ID: ${phoneNumberId})`);

    // Send via Meta WhatsApp Cloud API
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
    console.error("Error sending WhatsApp reply:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
