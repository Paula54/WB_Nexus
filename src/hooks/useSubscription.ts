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

interface RawSubscriptionData extends Omit<SubscriptionData, "plan_type"> {
  plan_type?: string | null;
  plan_name?: string | null;
}

interface ProjectPlanData {
  id: string;
  selected_plan: string | null;
  trial_expires_at: string | null;
}

interface SyncedSubscriptionData {
  id?: string;
  plan_type?: string | null;
  plan_name?: string | null;
  status?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  current_period_start?: string | null;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  project_id?: string | null;
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

  if (["growth", "nexus_growth", "nexusgrowth", "business", "pro", "professional"].includes(normalized)) {
    return "GROWTH";
  }

  if (["nexus_os", "nexusos", "os", "elite"].includes(normalized)) {
    return "NEXUS_OS";
  }

  return null;
}

function getSubscriptionPlanValue(subscription: { plan_type?: string | null; plan_name?: string | null } | null | undefined) {
  return subscription?.plan_name ?? subscription?.plan_type ?? null;
}

function hasFutureAccess(expiresAt: string | null | undefined) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

function isSubscriptionUsable(subscription: RawSubscriptionData | SubscriptionData | null | undefined) {
  if (!subscription) return false;

  const normalizedPlan = normalizePlanType(getSubscriptionPlanValue(subscription));
  const status = subscription.status?.trim().toLowerCase();

  if (!normalizedPlan || !status) return false;
  if (ACTIVE_SUBSCRIPTION_STATUSES.has(status)) return true;
  if (INACTIVE_SUBSCRIPTION_STATUSES.has(status)) return false;

  return hasFutureAccess(subscription.current_period_end ?? subscription.trial_ends_at);
}

function coerceSyncedSubscription(subscription: SyncedSubscriptionData | null | undefined): SubscriptionData | null {
  const normalizedPlan = normalizePlanType(getSubscriptionPlanValue(subscription));
  const status = subscription?.status?.trim().toLowerCase();

  if (!subscription || !normalizedPlan || !status) return null;

  return {
    id: subscription.id ?? `synced-${subscription.stripe_subscription_id ?? normalizedPlan.toLowerCase()}`,
    plan_type: normalizedPlan,
    status,
    trial_ends_at: subscription.trial_ends_at ?? null,
    current_period_end: subscription.current_period_end ?? null,
    current_period_start: subscription.current_period_start ?? null,
    stripe_subscription_id: subscription.stripe_subscription_id ?? null,
    stripe_customer_id: subscription.stripe_customer_id ?? null,
    project_id: subscription.project_id ?? null,
  };
}

export function useSubscription() {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [subscriptionRes, projectRes] = await Promise.allSettled([
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

      // Extract subscription data — this is critical, throw on failure
      const subResult = subscriptionRes.status === "fulfilled" ? subscriptionRes.value : null;
      if (!subResult || subResult.error) {
        const err = subResult?.error ?? { message: "subscriptions query rejected" };
        console.error("[useSubscription] subscriptions query error", err);
        throw err;
      }

      // Extract project data — non-critical, treat errors as "no project"
      let projectPlan: ProjectPlanData | null = null;
      if (projectRes.status === "fulfilled" && !projectRes.value.error) {
        projectPlan = projectRes.value.data as ProjectPlanData | null;
      } else {
        const projErr = projectRes.status === "fulfilled" ? projectRes.value.error : projectRes.reason;
        console.warn("[useSubscription] projects query non-fatal error", projErr);
      }

      const dbSubscriptions = (subResult.data as RawSubscriptionData[] | null) ?? [];
      const dbSubscription = dbSubscriptions[0] ?? null;

      console.log("[useSubscription] fetched", {
        count: dbSubscriptions.length,
        first: dbSubscription ? {
          plan_type: (dbSubscription as any).plan_type,
          plan_name: (dbSubscription as any).plan_name,
          status: dbSubscription.status,
        } : null,
        userId: user.id,
      });

      const normalizedProjectPlan = normalizePlanType(projectPlan?.selected_plan);
      const usableSubscription = dbSubscriptions.find(isSubscriptionUsable) ?? null;
      const normalizedSubscriptionPlan = normalizePlanType(getSubscriptionPlanValue(usableSubscription));
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
                plan_type:
                  normalizePlanType(getSubscriptionPlanValue(dbSubscription)) ??
                  getSubscriptionPlanValue(dbSubscription) ??
                  "START",
              }
            : null;

      const resolvedStatus = resolvedSubscription?.status?.trim().toLowerCase() ?? null;
      const resolvedHasSubscription =
        (!!resolvedStatus && ACTIVE_SUBSCRIPTION_STATUSES.has(resolvedStatus) && !!normalizePlanType(resolvedSubscription?.plan_type)) ||
        projectPlanIsUsable;

      const shouldSyncSubscription = !usableSubscription || !resolvedHasSubscription;

      if (shouldSyncSubscription) {
        const syncResponse = await supabase.functions.invoke("check-subscription");

        if (syncResponse.error) {
          console.warn("[useSubscription] Subscription sync warning:", syncResponse.error);
        } else {
          const syncedData = syncResponse.data as { subscription?: SyncedSubscriptionData | null } | null;
          const syncedSubscription = coerceSyncedSubscription(syncedData?.subscription);

          if (syncedSubscription && isSubscriptionUsable(syncedSubscription)) {
            return {
              subscription: syncedSubscription,
              hasProjectPlanFallback: false,
            };
          }
        }
      }

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
