import { useState } from "react";
import { Facebook, MessageCircle, Megaphone } from "lucide-react";
import { ProgressBar } from "./ProgressBar";
import { SetupCard } from "./SetupCard";
import { SocialSetupFlow } from "./SocialSetupFlow";
import { AdLab } from "./AdLab";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import MetaAdsConnectModal from "@/components/ads/MetaAdsConnectModal";
import { useProjectData } from "@/hooks/useProjectData";
import { toast } from "sonner";

export function OnboardingDashboard() {
  const { socialConnected, whatsappConnected, firstCampaignLaunched, loading, progress, refetch } = useOnboardingStatus();
  const { project } = useProjectData();
  const [socialFlowOpen, setSocialFlowOpen] = useState(false);
  const [metaConnectOpen, setMetaConnectOpen] = useState(false);

  const handleWhatsAppSetup = () => {
    toast.info("Abre o Concierge (canto inferior direito) e diz: 'Quero configurar o WhatsApp'");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const campaignLocked = !socialConnected || !whatsappConnected;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
          Centro de Configuração ⚡
        </h1>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
          Configura tudo em 3 passos simples. Quando terminares, a tua máquina de vendas fica 100% automática.
        </p>
      </div>

      {/* Progress Bar */}
      <ProgressBar progress={progress} />

      {/* 3 Setup Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SetupCard
          icon={<Facebook className="h-8 w-8 text-neon-blue" />}
          title="Ligar Redes Sociais"
          description="Conecta o Facebook e Instagram para publicar automaticamente."
          connected={socialConnected}
          neonColor="blue"
          onAction={() => setSocialFlowOpen(true)}
        />
        <SetupCard
          icon={<MessageCircle className="h-8 w-8 text-neon-green" />}
          title="Ativar WhatsApp"
          description="Recebe e responde a clientes automaticamente via WhatsApp."
          connected={whatsappConnected}
          neonColor="green"
          onAction={handleWhatsAppSetup}
        />
        <SetupCard
          icon={<Megaphone className="h-8 w-8 text-neon-purple" />}
          title="Lançar Campanha"
          description="Cria e publica o teu primeiro anúncio gerado por IA."
          connected={firstCampaignLaunched}
          locked={campaignLocked}
          lockedMessage="Completa os passos anteriores"
          neonColor="purple"
          onAction={() => {}} // handled by AdLab below
        />
      </div>

      {/* Ad Lab */}
      <AdLab locked={campaignLocked} onCampaignLaunched={refetch} />

      {/* Dialogs */}
      <SocialSetupFlow
        open={socialFlowOpen}
        onOpenChange={setSocialFlowOpen}
        onHasPage={() => setMetaConnectOpen(true)}
      />
      <MetaAdsConnectModal
        open={metaConnectOpen}
        onOpenChange={setMetaConnectOpen}
        projectId={project?.id ?? null}
        onConnected={refetch}
      />
    </div>
  );
}
