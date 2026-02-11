import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProjectData } from "@/hooks/useProjectData";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { PlanSelector } from "@/components/strategy/PlanSelector";
import { useState } from "react";
import type { PlanType } from "@/types/nexus";

export default function Subscription() {
  const { toast } = useToast();
  const { project } = useProjectData();
  const { startCheckout, loading: checkoutLoading } = useStripeCheckout();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("NEXUS_OS");

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

      <PlanSelector selected={selectedPlan} onSelect={setSelectedPlan} />

      <Card className="glass">
        <CardHeader>
          <CardTitle>Ativar Plano</CardTitle>
          <CardDescription>
            Todos os planos incluem 14 dias de período experimental gratuito
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full bg-primary hover:bg-primary/90 font-bold text-base"
            size="lg"
            onClick={handleActivatePlan}
            disabled={checkoutLoading || !project?.id}
          >
            {checkoutLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                A preparar pagamento...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5 mr-2" />
                Ativar Plano {selectedPlan === "NEXUS_OS" ? "Elite" : selectedPlan} — 14 dias grátis
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
