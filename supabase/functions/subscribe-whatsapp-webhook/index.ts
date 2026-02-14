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
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
    // WABA ID from memory
    const WABA_ID = "882735787718831";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;

    // Step 1: Check current subscriptions
    const subsResponse = await fetch(
      `https://graph.facebook.com/v21.0/${WABA_ID}/subscribed_apps?access_token=${WHATSAPP_ACCESS_TOKEN}`
    );
    const subsData = await subsResponse.json();
    console.log("Current subscriptions:", JSON.stringify(subsData));

    // Step 2: Subscribe to messages field
    const subscribeResponse = await fetch(
      `https://graph.facebook.com/v21.0/${WABA_ID}/subscribed_apps`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: WHATSAPP_ACCESS_TOKEN,
        }),
      }
    );
    const subscribeData = await subscribeResponse.json();
    console.log("Subscribe result:", JSON.stringify(subscribeData));

    if (subscribeData.error) {
      return new Response(
        JSON.stringify({ success: false, error: subscribeData.error.message, details: subscribeData.error }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Verify the App subscription on the WABA
    const verifyResponse = await fetch(
      `https://graph.facebook.com/v21.0/${WABA_ID}/subscribed_apps?access_token=${WHATSAPP_ACCESS_TOKEN}`
    );
    const verifyData = await verifyResponse.json();

    return new Response(
      JSON.stringify({
        success: subscribeData.success === true,
        message: subscribeData.success ? "Webhook subscrito com sucesso ao campo 'messages'." : "Falha na subscrição.",
        current_subscriptions: verifyData.data || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("subscribe-whatsapp-webhook error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
