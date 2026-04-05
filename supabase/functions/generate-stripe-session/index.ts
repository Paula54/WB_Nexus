import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("PROD_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("PROD_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[generate-stripe-session] Validating checkout session:", session_id);

    // 1. Validate the Stripe checkout session
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);

    if (checkoutSession.payment_status !== "paid") {
      return new Response(JSON.stringify({ error: "Payment not completed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = checkoutSession.customer_details?.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "No email found in checkout session" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[generate-stripe-session] Checkout paid. Email:", email);

    // 2. Check if user already exists in Supabase Auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log("[generate-stripe-session] Existing user found:", userId);
    } else {
      // Create user with a random password (they can reset later)
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: checkoutSession.customer_details?.name || null,
        },
      });

      if (createError || !newUser.user) {
        console.error("[generate-stripe-session] Failed to create user:", createError);
        return new Response(JSON.stringify({ error: "Failed to create user account" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;
      console.log("[generate-stripe-session] New user created:", userId);
    }

    // 3. Generate a magic link / session for the user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError || !linkData) {
      console.error("[generate-stripe-session] Failed to generate link:", linkError);
      return new Response(JSON.stringify({ error: "Failed to generate session link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The generateLink returns properties with token info
    // We need to exchange this for actual tokens
    // Use signInWithOtp + admin to create a proper session
    // Alternative: use the OTP token hash from the link

    // Extract the token_hash and use verifyOtp to get real session tokens
    const tokenHash = linkData.properties?.hashed_token;
    
    if (!tokenHash) {
      console.error("[generate-stripe-session] No hashed_token in link data");
      // Fallback: return a redirect URL that the frontend can use
      return new Response(JSON.stringify({ 
        error: "Could not generate session tokens",
        fallback: true,
        email 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the OTP to get actual session tokens
    const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });

    if (verifyError || !verifyData.session) {
      console.error("[generate-stripe-session] verifyOtp failed:", verifyError);
      return new Response(JSON.stringify({ 
        error: "Session generation failed",
        fallback: true,
        email 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { access_token, refresh_token } = verifyData.session;

    console.log("[generate-stripe-session] Session tokens generated for user:", userId);

    return new Response(JSON.stringify({
      success: true,
      access_token,
      refresh_token,
      user_id: userId,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[generate-stripe-session] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
