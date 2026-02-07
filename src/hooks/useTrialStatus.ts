import { useProjectData } from "./useProjectData";

export interface TrialStatus {
  /** true if a plan was selected and trial is still active */
  isActive: boolean;
  /** true if trial existed but has expired */
  isExpired: boolean;
  /** true if no plan was ever selected (no restriction) */
  noPlan: boolean;
  /** days remaining (0 if expired) */
  daysRemaining: number;
  /** the selected plan name */
  plan: string | null;
  loading: boolean;
}

export function useTrialStatus(): TrialStatus {
  const { project, loading } = useProjectData();

  if (loading || !project) {
    return {
      isActive: false,
      isExpired: false,
      noPlan: true,
      daysRemaining: 0,
      plan: null,
      loading,
    };
  }

  const { selected_plan, trial_expires_at } = project;

  // No plan selected yet — no restrictions
  if (!selected_plan || !trial_expires_at) {
    return {
      isActive: false,
      isExpired: false,
      noPlan: true,
      daysRemaining: 0,
      plan: selected_plan,
      loading: false,
    };
  }

  const now = new Date();
  const expiresAt = new Date(trial_expires_at);
  const diffMs = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isExpired = diffMs <= 0;

  return {
    isActive: !isExpired,
    isExpired,
    noPlan: false,
    daysRemaining,
    plan: selected_plan,
    loading: false,
  };
}
