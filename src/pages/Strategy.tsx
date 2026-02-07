import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, CreditCard, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProjectData } from "@/hooks/useProjectData";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { PlanSelector } from "@/components/strategy/PlanSelector";
import { StrategyResults } from "@/components/strategy/StrategyResults";
import type { MarketingStrategyInput, MarketingStrategyResult, PlanType } from "@/types/nexus";

export default function Strategy() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { project } = useProjectData();
  const { startCheckout, loading: checkoutLoading } = useStripeCheckout();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<MarketingStrategyInput>({
    clientName: "",
    productService: "",
    audience: "",
    objective: "",
    plan: "NEXUS_OS",
  });
  const [result, setResult] = useState<MarketingStrategyResult | null>(null);

  // Handle checkout callback
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
        description: "Gera uma estratégia primeiro para criar o teu projeto.",
        variant: "destructive",
      });
      return;
    }
    await startCheckout(formData.plan, project.id);
  };

  const handleGenerate = async () => {
    if (!formData.clientName || !formData.productService || !formData.audience || !formData.objective) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor preenche todos os campos antes de gerar a estratégia.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Save selected plan and set trial
      if (user) {
        const trialExpires = new Date();
        trialExpires.setDate(trialExpires.getDate() + 14);

        const { data: existingProject } = await supabase
          .from("projects")
          .select("id")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingProject) {
          await supabase
            .from("projects")
            .update({
              selected_plan: formData.plan,
              trial_expires_at: trialExpires.toISOString(),
            } as Record<string, unknown>)
            .eq("id", existingProject.id);
        } else {
          await supabase
            .from("projects")
            .insert({
              user_id: user.id,
              name: formData.clientName,
              selected_plan: formData.plan,
              trial_expires_at: trialExpires.toISOString(),
            } as Record<string, unknown>);
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-strategy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao gerar estratégia");
      }

      const data = await response.json();
      setResult(data);
      toast({
        title: "Estratégia Gerada! ✨",
        description: `O teu plano ${formData.plan === "NEXUS_OS" ? "Elite" : formData.plan} está pronto.`,
      });
    } catch (error) {
      console.error("Error generating strategy:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar a estratégia. Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-nexus-gold" />
          Estratégia de Marketing AI
        </h1>
        <p className="text-muted-foreground mt-1">
          Escolhe o teu plano e gera uma estratégia completa em segundos
        </p>
      </div>

      {/* Plan Selector */}
      <PlanSelector
        selected={formData.plan}
        onSelect={(plan: PlanType) => setFormData({ ...formData, plan })}
      />

      {/* Project Data Form */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Dados do Projeto</CardTitle>
          <CardDescription>
            Preenche as informações para gerar a estratégia personalizada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Nome do Cliente/Negócio</Label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="Ex: Clínica Veterinária Patinhas"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="objective">Objetivo Principal</Label>
              <Input
                id="objective"
                value={formData.objective}
                onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                placeholder="Ex: Aumentar agendamentos em 50%"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="productService">Produto/Serviço</Label>
            <Textarea
              id="productService"
              value={formData.productService}
              onChange={(e) => setFormData({ ...formData, productService: e.target.value })}
              placeholder="Ex: Consultas veterinárias, cirurgias, pet shop..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="audience">Público-Alvo</Label>
            <Textarea
              id="audience"
              value={formData.audience}
              onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
              placeholder="Ex: Donos de animais de estimação na região de Lisboa, 25-55 anos..."
              rows={2}
            />
          </div>

          <Button
            className="w-full bg-nexus-gold text-nexus-navy hover:bg-nexus-gold/90 font-bold text-base"
            size="lg"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                A gerar a tua estratégia {formData.plan === "NEXUS_OS" ? "Elite" : ""}...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Gerar Estratégia Completa
              </>
            )}
          </Button>

          {/* Activate Plan Button */}
          {project?.id && (
            <Button
              className="w-full border-2 border-nexus-gold text-nexus-gold hover:bg-nexus-gold hover:text-nexus-navy font-bold text-base transition-all duration-300"
              variant="outline"
              size="lg"
              onClick={handleActivatePlan}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  A preparar pagamento...
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 mr-2" />
                  Ativar Plano {formData.plan === "NEXUS_OS" ? "Elite" : formData.plan} — 14 dias grátis
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result ? (
        <StrategyResults result={result} plan={formData.plan} />
      ) : (
        <Card className="glass min-h-[200px] flex items-center justify-center">
          <div className="text-center text-muted-foreground p-8">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">
              Escolhe um plano, preenche os dados e clica em "Gerar Estratégia"
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
