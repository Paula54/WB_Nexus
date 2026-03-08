import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProjectData } from "@/hooks/useProjectData";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { PlanSelector } from "@/components/strategy/PlanSelector";
import { CurrentPlanCard } from "@/components/subscription/CurrentPlanCard";
import type { PlanType } from "@/types/nexus";

const PLAN_RANK: Record<string, number> = { START: 1, GROWTH: 2, NEXUS_OS: 3 };
const PLAN_LABELS: Record<string, string> = { START: "Start", GROWTH: "Growth", NEXUS_OS: "Nexus OS" };

export default function Subscription() {
  const { toast } = useToast();
  const { project } = useProjectData();
  const { startCheckout, loading: checkoutLoading } = useStripeCheckout();
  const { subscription, isLoading: subLoading, hasSubscription } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("NEXUS_OS");

  // Pre-select the current plan when loaded
  useEffect(() => {
    if (subscription?.plan_type) {
      setSelectedPlan(subscription.plan_type as PlanType);
    }
  }, [subscription?.plan_type]);

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    if (checkoutStatus === "success") {
      toast({
        title: "Pagamento iniciado! 🎉",
        description: "O teu plano será ativado assim que o pagamento for confirmado.",
      });
      setSearchParams({}, { replace: true });
    } else if (checkoutStatus === "cancel") {
      toast({
        title: "Checkout cancelado",
        description: "Podes tentar novamente quando quiseres.",
        variant: "destructive",
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  const currentRank = subscription ? (PLAN_RANK[subscription.plan_type] ?? 0) : 0;
  const selectedRank = PLAN_RANK[selectedPlan] ?? 0;
  const isUpgrade = selectedRank > currentRank;
  const isDowngrade = selectedRank < currentRank;
  const isSamePlan = hasSubscription && selectedRank === currentRank;

  const handleActivatePlan = async () => {
    if (!project?.id) {
      toast({
        title: "Projeto não encontrado",
        description: "Cria primeiro um projeto nas definições.",
        variant: "destructive",
      });
      return;
    }
    await startCheckout(selectedPlan, project.id);
  };

  const getButtonLabel = () => {
    const label = PLAN_LABELS[selectedPlan] ?? selectedPlan;
    if (isSamePlan) return `Plano ${label} — Já ativo`;
    if (isUpgrade) return `Upgrade para ${label}`;
    if (isDowngrade) return `Downgrade para ${label}`;
    return `Ativar Plano ${label} — 14 dias grátis`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          Faturação & Planos
        </h1>
        <p className="text-muted-foreground mt-1">
          Escolhe o plano ideal para o teu negócio
        </p>
      </div>

      {/* Current plan card */}
      {subLoading ? (
        <Card className="glass animate-pulse h-32" />
      ) : hasSubscription && subscription ? (
        <CurrentPlanCard subscription={subscription} />
      ) : (
        <Card className="glass border-dashed border-muted-foreground/20">
          <CardContent className="py-6 text-center">
            <p className="text-muted-foreground text-sm">
              Ainda não tens um plano ativo. Escolhe abaixo e experimenta grátis por 14 dias.
            </p>
          </CardContent>
        </Card>
      )}

      <PlanSelector selected={selectedPlan} onSelect={setSelectedPlan} />

      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>
              {isSamePlan ? "Plano Atual" : isUpgrade ? "Upgrade de Plano" : isDowngrade ? "Downgrade de Plano" : "Ativar Plano"}
            </CardTitle>
            {isUpgrade && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><ArrowUpRight className="h-3 w-3 mr-1" />Upgrade</Badge>}
            {isDowngrade && <Badge variant="secondary"><ArrowDownRight className="h-3 w-3 mr-1" />Downgrade</Badge>}
          </div>
          <CardDescription>
            {isSamePlan
              ? "Este já é o teu plano ativo."
              : hasSubscription
                ? isUpgrade
                  ? "Ao fazer upgrade, as novas funcionalidades ficam disponíveis imediatamente."
                  : "Ao fazer downgrade, as alterações aplicam-se no próximo ciclo de faturação."
                : "Todos os planos incluem 14 dias de período experimental gratuito."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full bg-primary hover:bg-primary/90 font-bold text-base"
            size="lg"
            onClick={handleActivatePlan}
            disabled={checkoutLoading || !project?.id || isSamePlan}
          >
            {checkoutLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                A preparar pagamento...
              </>
            ) : (
              <>
                {isUpgrade && <ArrowUpRight className="h-5 w-5 mr-2" />}
                {isDowngrade && <ArrowDownRight className="h-5 w-5 mr-2" />}
                {!isUpgrade && !isDowngrade && <CreditCard className="h-5 w-5 mr-2" />}
                {getButtonLabel()}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
