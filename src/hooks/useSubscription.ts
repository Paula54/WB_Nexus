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
const INACTIVE_SUBSCRIPTION_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

function normalizePlanType(planType: string | null | undefined) {
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

  if (["growth", "nexus_growth", "nexusgrowth", "business"].includes(normalized)) {
    return "GROWTH";
  }

  if (["nexus_os", "nexusos", "os", "elite"].includes(normalized)) {
    return "NEXUS_OS";
  }

  return null;
}

function hasFutureAccess(expiresAt: string | null | undefined) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

function isSubscriptionUsable(subscription: SubscriptionData | null | undefined) {
  if (!subscription) return false;

  const normalizedPlan = normalizePlanType(subscription.plan_type);
  const status = subscription.status?.trim().toLowerCase();

  if (!normalizedPlan || !status) return false;
  if (ACTIVE_SUBSCRIPTION_STATUSES.has(status)) return true;
  if (INACTIVE_SUBSCRIPTION_STATUSES.has(status)) return false;

  return hasFutureAccess(subscription.current_period_end ?? subscription.trial_ends_at);
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
          .limit(10),
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

      const dbSubscriptions = (subscriptionRes.data as SubscriptionData[] | null) ?? [];
      const dbSubscription = dbSubscriptions[0] ?? null;
      const projectPlan = projectRes.data as ProjectPlanData | null;

      const normalizedProjectPlan = normalizePlanType(projectPlan?.selected_plan);
      const usableSubscription = dbSubscriptions.find(isSubscriptionUsable) ?? null;
      const normalizedSubscriptionPlan = normalizePlanType(usableSubscription?.plan_type);
      const hasStripeSubscriptionHistory = dbSubscriptions.some(
        (subscription) => !!subscription.stripe_subscription_id || !!subscription.stripe_customer_id,
      );

      const projectPlanIsUsable =
        !!normalizedProjectPlan &&
        (hasFutureAccess(projectPlan?.trial_expires_at) || (!usableSubscription && !hasStripeSubscriptionHistory));

      const resolvedSubscription = usableSubscription && normalizedSubscriptionPlan
        ? {
            ...usableSubscription,
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
                plan_type: normalizePlanType(dbSubscription.plan_type) ?? dbSubscription.plan_type,
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
