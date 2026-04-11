import { useSubscription } from "./useSubscription";

export interface TrialStatus {
  isActive: boolean;
  isExpired: boolean;
  noPlan: boolean;
  daysRemaining: number;
  plan: string | null;
  loading: boolean;
}

export function useTrialStatus(): TrialStatus {
  const { subscription, hasSubscription, isLoading } = useSubscription();

  const plan = subscription?.plan_type ?? null;
  const expiresAt = subscription?.trial_ends_at ?? subscription?.current_period_end ?? null;
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : null;
  const isExpired = !hasSubscription && expiresAtMs !== null && expiresAtMs <= Date.now();
  const daysRemaining = expiresAtMs
    ? Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 86400000))
    : 0;

  return {
    isActive: hasSubscription,
    isExpired,
    noPlan: !plan,
    daysRemaining,
    plan,
    loading: isLoading,
  };
}
