import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";

export interface SubscriptionData {
  id: string;
  plan_type: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  current_period_start: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  project_id: string | null;
}

interface ProjectPlanData {
  id: string;
  selected_plan: string | null;
  trial_expires_at: string | null;
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

function normalizePlanType(planType: string | null | undefined) {
  if (!planType) return null;

  const normalized = planType.trim().toUpperCase().replace(/-/g, "_");
  return ["START", "GROWTH", "NEXUS_OS"].includes(normalized) ? normalized : null;
}

function hasFutureAccess(expiresAt: string | null | undefined) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export function useSubscription() {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [subscriptionRes, projectRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("projects")
          .select("id, selected_plan, trial_expires_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (subscriptionRes.error) throw subscriptionRes.error;
      if (projectRes.error) throw projectRes.error;

      const dbSubscription = subscriptionRes.data as SubscriptionData | null;
      const projectPlan = projectRes.data as ProjectPlanData | null;

      const normalizedSubscriptionPlan = normalizePlanType(dbSubscription?.plan_type);
      const normalizedProjectPlan = normalizePlanType(projectPlan?.selected_plan);
      const subscriptionStatus = dbSubscription?.status?.toLowerCase() ?? null;

      const subscriptionIsUsable = !!dbSubscription && !!normalizedSubscriptionPlan && !!subscriptionStatus && ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus);
      const projectPlanIsUsable = !!normalizedProjectPlan && hasFutureAccess(projectPlan?.trial_expires_at);

      const resolvedSubscription = subscriptionIsUsable
        ? {
            ...dbSubscription,
            plan_type: normalizedSubscriptionPlan,
          }
        : projectPlanIsUsable
          ? {
              id: `project-${projectPlan!.id}`,
              plan_type: normalizedProjectPlan,
              status: "active",
              trial_ends_at: projectPlan?.trial_expires_at ?? null,
              current_period_end: projectPlan?.trial_expires_at ?? null,
              current_period_start: null,
              stripe_subscription_id: dbSubscription?.stripe_subscription_id ?? null,
              stripe_customer_id: dbSubscription?.stripe_customer_id ?? null,
              project_id: projectPlan!.id,
            }
          : dbSubscription
            ? {
                ...dbSubscription,
                plan_type: normalizedSubscriptionPlan ?? dbSubscription.plan_type,
              }
            : null;

      return {
        subscription: resolvedSubscription,
        hasProjectPlanFallback: projectPlanIsUsable,
      };
    },
    enabled: !!user,
  });

  const subscription = data?.subscription ?? null;
  const status = subscription?.status?.toLowerCase() ?? null;
  const isTrialing = subscription?.status === "trialing";
  const isActive = status === "active" || status === "past_due";
  const isCanceled = status === "canceled";
  const hasValidPlan = !!normalizePlanType(subscription?.plan_type);
  const hasSubscription = (!!status && ACTIVE_SUBSCRIPTION_STATUSES.has(status) && hasValidPlan) || !!data?.hasProjectPlanFallback;

  return {
    subscription,
    isLoading,
    refetch,
    isTrialing,
    isActive,
    isCanceled,
    hasSubscription,
  };
}
