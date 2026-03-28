import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { OnboardingDashboard } from "@/components/onboarding/OnboardingDashboard";
import { RegularDashboard } from "@/components/dashboard/RegularDashboard";
import { NoPlanBanner } from "@/components/dashboard/NoPlanBanner";
import { useSubscription } from "@/hooks/useSubscription";

export default function Dashboard() {
  const { socialConnected, whatsappConnected, firstCampaignLaunched, loading } = useOnboardingStatus();
  const { subscription, isLoading: subLoading, hasSubscription } = useSubscription();

  if (loading || subLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // TODO: TEMPORARY — force onboarding view for demo. Remove this line to restore normal behavior.
  const onboardingComplete = false; // socialConnected && whatsappConnected && firstCampaignLaunched;

  return (
    <div className="space-y-6">
      {!hasSubscription && <NoPlanBanner />}
      {!onboardingComplete ? <OnboardingDashboard /> : <RegularDashboard />}
    </div>
  );
}
