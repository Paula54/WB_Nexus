import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);
const PLAN_BY_PRICE_ID = {
  price_1TDWcVE6rYpESbYpc6Pv0Gp6: "START",
  price_1TDWfxE6rYpESbYpuWFi5qnL: "GROWTH",
  price_1TDWwyE6rYpESbYpHEHNEeAG: "NEXUS_OS",
} as const;

type PlanType = "START" | "GROWTH" | "NEXUS_OS";

type CandidateSubscription = {
  customerId: string;
  planType: PlanType;
  subscription: Stripe.Subscription;
};

type SubscriptionWritePayload = {
  user_id: string;
  project_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  plan: PlanType;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

type ProjectPlanRecord = {
  id: string;
  selected_plan: string | null;
  trial_expires_at: string | null;
};

function normalizePlanType(planType: string | null | undefined): PlanType | null {
  if (!planType) return null;

  const normalized = planType
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (["start", "nexus_start", "nexusstart", "lite"].includes(normalized)) {
    return "START";
  }

  if (["growth", "nexus_growth", "nexusgrowth", "business", "pro", "professional"].includes(normalized)) {
    return "GROWTH";
  }

  if (["nexus_os", "nexusos", "os", "elite"].includes(normalized)) {
    return "NEXUS_OS";
  }

  return null;
}

function resolvePlanType(subscription: Stripe.Subscription): PlanType | null {
  const metadataPlan = normalizePlanType(subscription.metadata?.plan_name ?? subscription.metadata?.plan_type);
  if (metadataPlan) return metadataPlan;

  for (const item of subscription.items.data) {
    const planFromPrice = PLAN_BY_PRICE_ID[item.price.id as keyof typeof PLAN_BY_PRICE_ID];
    if (planFromPrice) return planFromPrice;
  }

  return null;
}

function toIso(timestamp: number | null | undefined) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function hasFutureAccess(expiresAt: string | null | undefined) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

function getErrorMessage(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message ?? "");
  return String(error);
}

function isMissingColumnError(error: unknown, column: string) {
  return getErrorMessage(error).toLowerCase().includes(column.toLowerCase());
}

function buildPlanNamePayload(payload: SubscriptionWritePayload) {
  const { plan, ...rest } = payload;
  return { ...rest, plan_name: plan };
}

function buildPlanTypePayload(payload: SubscriptionWritePayload) {
  const { plan, ...rest } = payload;
  return { ...rest, plan_type: plan };
}

async function insertSubscriptionRecord(supabaseAdmin: ReturnType<typeof createClient>, payload: SubscriptionWritePayload) {
  let response = await supabaseAdmin.from("subscriptions").insert(buildPlanNamePayload(payload));

  if (response.error && isMissingColumnError(response.error, "plan_name")) {
    response = await supabaseAdmin.from("subscriptions").insert(buildPlanTypePayload(payload));
  }

  return response;
}

async function updateSubscriptionRecord(
  supabaseAdmin: ReturnType<typeof createClient>,
  subscriptionId: string,
  payload: SubscriptionWritePayload,
) {
  let response = await supabaseAdmin
    .from("subscriptions")
    .update(buildPlanNamePayload(payload))
    .eq("id", subscriptionId);

  if (response.error && isMissingColumnError(response.error, "plan_name")) {
    response = await supabaseAdmin
      .from("subscriptions")
      .update(buildPlanTypePayload(payload))
      .eq("id", subscriptionId);
  }

  return response;
}

function compareCandidates(a: CandidateSubscription, b: CandidateSubscription) {
  const statusPriority = { active: 3, trialing: 2, past_due: 1 } as const;
  const statusDiff =
    (statusPriority[b.subscription.status as keyof typeof statusPriority] ?? 0) -
    (statusPriority[a.subscription.status as keyof typeof statusPriority] ?? 0);

  if (statusDiff !== 0) return statusDiff;

  const periodEndDiff = (b.subscription.current_period_end ?? 0) - (a.subscription.current_period_end ?? 0);
  if (periodEndDiff !== 0) return periodEndDiff;

  return (b.subscription.created ?? 0) - (a.subscription.created ?? 0);
}

async function ensureProjectId(supabaseAdmin: ReturnType<typeof createClient>, userId: string) {
  const { data: existingProject, error: existingProjectError } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingProjectError) {
    console.error("[check-subscription] Project lookup error:", existingProjectError);
  }

  if (existingProject?.id) {
    return existingProject.id;
  }

  const { data: newProject, error: newProjectError } = await supabaseAdmin
    .from("projects")
    .insert({ user_id: userId, name: "Meu Projeto", project_type: "website" })
    .select("id")
    .single();

  if (newProjectError) {
    console.error("[check-subscription] Project creation error:", newProjectError);
    return null;
  }

  return newProject?.id ?? null;
}

async function getLatestProjectPlan(supabaseAdmin: ReturnType<typeof createClient>, userId: string) {
  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, selected_plan, trial_expires_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[check-subscription] Project plan lookup error:", error);
  }

  return (project as ProjectPlanRecord | null) ?? null;
}

async function ensureFallbackSubscriptionFromProject(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  project: ProjectPlanRecord,
) {
  const normalizedProjectPlan = normalizePlanType(project.selected_plan);
  if (!normalizedProjectPlan) return null;

  const expiresAt = project.trial_expires_at && hasFutureAccess(project.trial_expires_at)
    ? project.trial_expires_at
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const payload: SubscriptionWritePayload = {
    user_id: userId,
    project_id: project.id,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    status: "active",
    plan: normalizedProjectPlan,
    trial_ends_at: expiresAt,
    current_period_start: new Date().toISOString(),
    current_period_end: expiresAt,
  };

  const { data: existingSubscription, error: existingSubscriptionError } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSubscriptionError) {
    console.error("[check-subscription] Existing fallback subscription lookup error:", existingSubscriptionError);
  }

  if (existingSubscription?.id) {
    const { error: updateError } = await updateSubscriptionRecord(supabaseAdmin, existingSubscription.id, payload);

    if (updateError) {
      console.error("[check-subscription] Fallback subscription update error:", updateError);
      return null;
    }

    return {
      id: existingSubscription.id,
      ...buildPlanNamePayload(payload),
    };
  }

  const { error: insertError } = await insertSubscriptionRecord(supabaseAdmin, payload);

  if (insertError) {
    console.error("[check-subscription] Fallback subscription insert error:", insertError);
    return null;
  }

  return {
    id: `project-${project.id}`,
    ...buildPlanNamePayload(payload),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Serviço indisponível." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user?.email) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customers = await stripe.customers.list({ email: user.email, limit: 10 });
    const candidates: CandidateSubscription[] = [];

    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 20,
      });

      for (const subscription of subscriptions.data) {
        if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) continue;

        const planType = resolvePlanType(subscription);
        if (!planType) continue;

        candidates.push({ customerId: customer.id, subscription, planType });
      }
    }

    const activeSubscription = candidates.sort(compareCandidates)[0] ?? null;

    if (!activeSubscription) {
      const fallbackProject = await getLatestProjectPlan(supabaseAdmin, user.id);
      if (fallbackProject?.id && fallbackProject.selected_plan) {
        const fallbackSubscription = await ensureFallbackSubscriptionFromProject(supabaseAdmin, user.id, fallbackProject);

        if (fallbackSubscription) {
          return new Response(JSON.stringify({ subscribed: true, subscription: fallbackSubscription }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ subscribed: false, subscription: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projectId = await ensureProjectId(supabaseAdmin, user.id);
    const periodEnd = toIso(activeSubscription.subscription.current_period_end);
    const trialEnd = toIso(activeSubscription.subscription.trial_end);
    const subscriptionPayload: SubscriptionWritePayload = {
      user_id: user.id,
      project_id: projectId,
      stripe_customer_id: activeSubscription.customerId,
      stripe_subscription_id: activeSubscription.subscription.id,
      status: activeSubscription.subscription.status,
      plan: activeSubscription.planType,
      trial_ends_at: trialEnd,
      current_period_start: toIso(activeSubscription.subscription.current_period_start),
      current_period_end: periodEnd,
    };

    const { data: existingSubscription, error: existingSubscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", activeSubscription.subscription.id)
      .maybeSingle();

    if (existingSubscriptionError) {
      console.error("[check-subscription] Subscription lookup error:", existingSubscriptionError);
    }

    if (existingSubscription?.id) {
      const { error: updateError } = await updateSubscriptionRecord(supabaseAdmin, existingSubscription.id, subscriptionPayload);

      if (updateError) {
        console.error("[check-subscription] Subscription update error:", updateError);
      }
    } else {
      const { error: insertError } = await insertSubscriptionRecord(supabaseAdmin, subscriptionPayload);

      if (insertError) {
        console.error("[check-subscription] Subscription insert error:", insertError);
      }
    }

    if (projectId) {
      const { error: projectUpdateError } = await supabaseAdmin
        .from("projects")
        .update({
          selected_plan: activeSubscription.planType,
          trial_expires_at: trialEnd ?? periodEnd,
        })
        .eq("id", projectId);

      if (projectUpdateError) {
        console.error("[check-subscription] Project update error:", projectUpdateError);
      }
    }

    return new Response(
      JSON.stringify({
        subscribed: true,
        subscription: {
          id: existingSubscription?.id ?? `stripe-${activeSubscription.subscription.id}`,
            ...buildPlanNamePayload(subscriptionPayload),
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[check-subscription] Internal error:", error);
    return new Response(JSON.stringify({ error: "Ocorreu um erro interno. Tenta novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});