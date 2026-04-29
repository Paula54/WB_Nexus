import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Share2, MessageCircle, Megaphone, Fingerprint } from "lucide-react";
import { ProgressBar } from "./ProgressBar";
import { SetupCard } from "./SetupCard";
import { SocialSetupFlow } from "./SocialSetupFlow";
import { WhatsAppSetupModal } from "./WhatsAppSetupModal";
import { MyUsage } from "@/components/dashboard/MyUsage";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import MetaAdsConnectModal from "@/components/ads/MetaAdsConnectModal";
import { useProjectData } from "@/hooks/useProjectData";

export function OnboardingDashboard() {
  const { dnaConfigured, socialConnected, whatsappConnected, firstCampaignLaunched, loading, progress, refetch } = useOnboardingStatus();
  const { project } = useProjectData();
  const navigate = useNavigate();
  const [socialFlowOpen, setSocialFlowOpen] = useState(false);
  const [metaConnectOpen, setMetaConnectOpen] = useState(false);
  const [whatsappSetupOpen, setWhatsappSetupOpen] = useState(false);

  const handleWhatsAppSetup = () => {
    // Abre sempre o modal de WhatsApp. Se o DNA ainda não estiver configurado,
    // o card aparece bloqueado (whatsappLocked) e este handler nem é chamado.
    setWhatsappSetupOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const socialLocked = !dnaConfigured;
  const whatsappLocked = !dnaConfigured;
  const campaignLocked = !dnaConfigured || !socialConnected || !whatsappConnected;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center animate-fade-in">
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
          Centro de Configuração ⚡
        </h1>
        <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
          Bem-vindo! Antes de começarmos, precisamos de definir quem tu és. Configura o DNA do teu negócio no Passo 1 para que a WB Nexus possa trabalhar por ti.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="animate-fade-in" style={{ animationDelay: "150ms", animationFillMode: "both" }}>
        <ProgressBar progress={progress} />
      </div>

      {/* 4 Setup Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="animate-fade-in" style={{ animationDelay: "300ms", animationFillMode: "both" }}>
          <SetupCard
            icon={<Fingerprint className="h-8 w-8 text-neon-purple" />}
            title="Definir DNA do Negócio"
            description="Diz-nos quem és e o que fazes para a IA trabalhar à tua medida."
            connected={dnaConfigured}
            neonColor="purple"
            onAction={() => navigate("/profile")}
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: "450ms", animationFillMode: "both" }}>
          <SetupCard
            icon={<Share2 className="h-8 w-8 text-neon-blue" />}
            title="Ligar Redes Sociais"
            description="Conecta o Facebook e Instagram para publicar automaticamente."
            connected={socialConnected}
            locked={socialLocked}
            lockedMessage="Configura o DNA primeiro"
            neonColor="blue"
            onAction={() => setSocialFlowOpen(true)}
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: "600ms", animationFillMode: "both" }}>
          <SetupCard
            icon={<MessageCircle className="h-8 w-8 text-neon-green" />}
            title="Ativar WhatsApp"
            description="Recebe e responde a clientes automaticamente via WhatsApp."
            connected={whatsappConnected}
            locked={whatsappLocked}
            lockedMessage="Configura o DNA primeiro"
            neonColor="green"
            onAction={handleWhatsAppSetup}
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: "750ms", animationFillMode: "both" }}>
          <SetupCard
            icon={<Megaphone className="h-8 w-8 text-neon-purple" />}
            title="Lançar Campanha"
            description="Cria e publica o teu primeiro anúncio gerado por IA."
            connected={firstCampaignLaunched}
            locked={campaignLocked}
            lockedMessage="Completa os passos anteriores"
            neonColor="purple"
            onAction={() => navigate("/ads")}
          />
        </div>
      </div>

      {/* Quotas */}
      <div className="animate-fade-in" style={{ animationDelay: "1050ms", animationFillMode: "both" }}>
        <MyUsage />
      </div>

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
      <WhatsAppSetupModal
        open={whatsappSetupOpen}
        onOpenChange={setWhatsappSetupOpen}
        projectId={project?.id ?? null}
        onConnected={() => {
          refetch();
          window.dispatchEvent(
            new CustomEvent("nexus-concierge:open", {
              detail: { prompt: "Acabei de ligar o WhatsApp Business com sucesso. Confirma a ligação e indica o próximo passo." },
            })
          );
        }}
      />
    </div>
  );
}
