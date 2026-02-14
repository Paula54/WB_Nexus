import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { OnboardingDashboard } from "@/components/onboarding/OnboardingDashboard";
import { RegularDashboard } from "@/components/dashboard/RegularDashboard";

export default function Dashboard() {
  const { socialConnected, whatsappConnected, firstCampaignLaunched, loading } = useOnboardingStatus();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // TODO: TEMPORARY — force onboarding view for demo. Remove this line to restore normal behavior.
  const onboardingComplete = false; // socialConnected && whatsappConnected && firstCampaignLaunched;

  if (!onboardingComplete) {
    return <OnboardingDashboard />;
  }

  return <RegularDashboard />;
}
