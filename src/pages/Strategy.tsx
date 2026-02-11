import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Building2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useProjectData } from "@/hooks/useProjectData";
import { StrategyResults } from "@/components/strategy/StrategyResults";
import type { MarketingStrategyInput, MarketingStrategyResult } from "@/types/nexus";

interface BusinessSummary {
  trade_name: string | null;
  legal_name: string | null;
  nif: string | null;
}

export default function Strategy() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { project } = useProjectData();
  const [loading, setLoading] = useState(false);
  const [business, setBusiness] = useState<BusinessSummary | null>(null);
  const [formData, setFormData] = useState<MarketingStrategyInput>({
    clientName: "",
    productService: "",
    audience: "",
    objective: "",
    plan: "NEXUS_OS",
  });
  const [result, setResult] = useState<MarketingStrategyResult | null>(null);

  // Fetch business profile data
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("business_profiles" as string)
        .select("trade_name, legal_name, nif")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const d = data as Record<string, unknown>;
        const biz: BusinessSummary = {
          trade_name: (d.trade_name as string) || null,
          legal_name: (d.legal_name as string) || null,
          nif: (d.nif as string) || null,
        };
        setBusiness(biz);
        // Pre-fill client name from business profile
        if (biz.trade_name || biz.legal_name) {
          setFormData((prev) => ({
            ...prev,
            clientName: prev.clientName || biz.trade_name || biz.legal_name || "",
          }));
        }
      }
    })();
  }, [user]);

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

      if (!response.ok) throw new Error("Erro ao gerar estratégia");

      const data = await response.json();
      setResult(data);
      toast({
        title: "Estratégia Gerada! ✨",
        description: "A tua estratégia de marketing personalizada está pronta.",
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
          <Sparkles className="h-8 w-8 text-primary" />
          Estratégia de Marketing AI
        </h1>
        <p className="text-muted-foreground mt-1">
          Preenche os dados do projeto e gera uma estratégia completa em segundos
        </p>
      </div>

      {/* Business Profile Summary */}
      {business && (business.trade_name || business.legal_name) ? (
        <Card className="glass border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{business.trade_name || business.legal_name}</span>
                {business.nif && (
                  <Badge variant="secondary" className="text-xs">NIF {business.nif}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dados carregados do perfil da empresa
              </p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-sm text-muted-foreground">
              <a href="/settings" className="text-primary hover:underline font-medium">Preenche os Dados da Empresa</a> para pré-carregar automaticamente o nome do negócio.
            </p>
          </CardContent>
        </Card>
      )}

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
            className="w-full font-bold text-base"
            size="lg"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                A gerar a tua estratégia...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Gerar Estratégia Completa
              </>
            )}
          </Button>
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
              Preenche os dados e clica em "Gerar Estratégia"
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
