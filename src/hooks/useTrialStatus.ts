import { useProjectData } from "./useProjectData";

export interface TrialStatus {
  isActive: boolean;
  isExpired: boolean;
  noPlan: boolean;
  daysRemaining: number;
  plan: string | null;
  loading: boolean;
}

export function useTrialStatus(): TrialStatus {
  const { loading } = useProjectData();

  // External DB doesn't have trial_expires_at or selected_plan
  // Return no-restriction defaults
  return {
    isActive: false,
    isExpired: false,
    noPlan: true,
    daysRemaining: 0,
    plan: null,
    loading,
  };
}
