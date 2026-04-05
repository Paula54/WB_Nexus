import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useToast } from "@/hooks/use-toast";
import { getPlanBySlug, PLANS, type PlanConfig } from "@/data/plans";
import { BillingForm } from "@/components/checkout/BillingForm";
import { PlanBadge } from "@/components/checkout/PlanBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, AlertTriangle } from "lucide-react";

export default function BusinessSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { startCheckout, loading: checkoutLoading } = useStripeCheckout();
  const [searchParams] = useSearchParams();

  const [saved, setSaved] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Resolve plan from URL — NO default fallback
  const planSlug = searchParams.get("plan");
  const plan: PlanConfig | null = getPlanBySlug(planSlug);

  // Load project
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (project) setProjectId(project.id);
    };
    load();
  }, [user]);

  const handleCheckout = () => {
    if (!projectId || !plan) return;
    startCheckout(plan.key, projectId);
  };

  // Invalid or missing plan → show plan selection screen
  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="py-10 text-center space-y-6">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-display font-bold text-foreground">
              Plano não identificado
            </h1>
            <p className="text-muted-foreground text-sm">
              Não foi possível identificar o plano selecionado. Escolhe um dos planos abaixo:
            </p>
            <div className="grid gap-3">
              {Object.values(PLANS).map((p) => (
                <Button
                  key={p.slug}
                  variant="outline"
                  className="w-full justify-between h-auto py-3"
                  onClick={() => navigate(`/setup?plan=${p.slug}`)}
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {p.setupFee}€ + {p.monthlyPrice}€/mês
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-display font-bold text-foreground">
            Configuração do Negócio
          </h1>
          <p className="text-muted-foreground">
            Preenche os dados de faturação para ativar o teu plano.
          </p>
        </div>

        <PlanBadge plan={plan} />

        <BillingForm onSaved={setSaved} />

        <Button
          onClick={handleCheckout}
          disabled={!saved || checkoutLoading || !projectId}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {checkoutLoading ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <CreditCard className="h-5 w-5 mr-2" />
          )}
          Finalizar Pagamento — {plan.setupFee}€ + {plan.monthlyPrice}€/mês
        </Button>

        {!saved && (
          <p className="text-center text-xs text-muted-foreground">
            Preenche e guarda os dados de faturação para desbloquear o pagamento.
          </p>
        )}
      </div>
    </div>
  );
}
