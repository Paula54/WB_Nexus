// @ts-ignore - Stripe types pull in @types/node which Deno can't resolve
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getErrorMessage(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message ?? "");
  return String(error);
}

function isMissingColumnError(error: unknown, column: string) {
  return getErrorMessage(error).toLowerCase().includes(column.toLowerCase());
}

function buildPlanPayload(payload: Record<string, unknown>, plan: string, useLegacyColumn = false) {
  return {
    ...payload,
    ...(useLegacyColumn ? { plan_type: plan } : { plan_name: plan }),
  };
}

async function insertSubscriptionRecord(supabaseAdmin: any, payload: Record<string, unknown>, plan: string) {
  let response = await supabaseAdmin
    .from("subscriptions")
    .insert(buildPlanPayload(payload, plan));

  if (response.error && isMissingColumnError(response.error, "plan_name")) {
    response = await supabaseAdmin
      .from("subscriptions")
      .insert(buildPlanPayload(payload, plan, true));
  }

  return response;
}

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
      // Create user with a random password (they will set it on /register)
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

      // Create profile
      await supabaseAdmin.from("profiles").insert({
        user_id: userId,
        full_name: checkoutSession.customer_details?.name || null,
        contact_email: email,
      });
    }

    // 3. Ensure subscription record exists
    const planType = checkoutSession.metadata?.plan_name || checkoutSession.metadata?.plan_type || "START";
    const stripeSubId = checkoutSession.subscription as string | null;

    if (stripeSubId) {
      // Check if subscription record already exists
      const { data: existingSub } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", stripeSubId)
        .maybeSingle();

      if (!existingSub) {
        // Retrieve subscription details from Stripe
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
        const mappedStatus = stripeSub.status === "trialing" ? "trialing" : "active";

        // Find or create project
        let projectId: string | null = checkoutSession.metadata?.project_id || null;
        if (!projectId) {
          const { data: existingProject } = await supabaseAdmin
            .from("projects")
            .select("id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();

          if (existingProject) {
            projectId = existingProject.id;
          } else {
            const { data: newProject } = await supabaseAdmin
              .from("projects")
              .insert({ user_id: userId, name: "Meu Projeto", project_type: "website" })
              .select("id")
              .single();
            projectId = newProject?.id || null;
          }
        }

        const { error: subError } = await insertSubscriptionRecord(supabaseAdmin, {
          user_id: userId,
          project_id: projectId,
          stripe_customer_id: checkoutSession.customer as string,
          stripe_subscription_id: stripeSubId,
          status: mappedStatus,
          trial_ends_at: stripeSub.trial_end
            ? new Date(stripeSub.trial_end * 1000).toISOString()
            : null,
          current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
        }, planType);

        if (subError) {
          console.error("[generate-stripe-session] Subscription insert error:", subError);
        } else {
          console.log("[generate-stripe-session] Subscription record created for user:", userId);
        }

        // Update project plan
        if (projectId) {
          const trialEndsAt = stripeSub.trial_end
            ? new Date(stripeSub.trial_end * 1000).toISOString()
            : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
          await supabaseAdmin
            .from("projects")
            .update({ selected_plan: planType, trial_expires_at: trialEndsAt })
            .eq("id", projectId);
        }
      } else {
        console.log("[generate-stripe-session] Subscription record already exists");
      }
    } else {
      // No Stripe subscription (one-time payment or checkout without subscription)
      // Still check if user has any subscription record
      const { data: anySub } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!anySub) {
        // Create a basic subscription record based on checkout
        let projectId: string | null = null;
        const { data: existingProject } = await supabaseAdmin
          .from("projects")
          .select("id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();

        if (existingProject) {
          projectId = existingProject.id;
        } else {
          const { data: newProject } = await supabaseAdmin
            .from("projects")
            .insert({ user_id: userId, name: "Meu Projeto", project_type: "website" })
            .select("id")
            .single();
          projectId = newProject?.id || null;
        }

        await insertSubscriptionRecord(supabaseAdmin, {
          user_id: userId,
          project_id: projectId,
          stripe_customer_id: (checkoutSession.customer as string) || null,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }, planType);
        console.log("[generate-stripe-session] Basic subscription record created for user:", userId);
      }
    }

    // 4. Generate session tokens
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

    const tokenHash = linkData.properties?.hashed_token;
    
    if (!tokenHash) {
      console.error("[generate-stripe-session] No hashed_token in link data");
      return new Response(JSON.stringify({ 
        error: "Could not generate session tokens",
        fallback: true,
        email 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
