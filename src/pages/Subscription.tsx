import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Wallet, Globe, CreditCard, Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { CurrentPlanCard } from "@/components/subscription/CurrentPlanCard";
import { supabase } from "@/lib/supabaseCustom";
import { toast } from "@/hooks/use-toast";

const SITE_PRICING_URL = "https://site.web-business.pt/#pricing";

export default function Subscription() {
  const navigate = useNavigate();
  const { subscription, isLoading: subLoading, hasSubscription } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-billing-portal");
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("URL não recebido");
      }
    } catch (err: any) {
      console.error("Billing portal error:", err);
      toast({
        title: "Erro ao abrir portal",
        description: err?.message || "Tenta novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Plano & Faturação
        </h1>
        <p className="text-muted-foreground mt-1">
          Gere o teu plano Nexus e os serviços adicionais
        </p>
      </div>

      {/* Current plan card (read-only — plans are sold on the Site) */}
      {subLoading ? (
        <Card className="glass animate-pulse h-32" />
      ) : hasSubscription && subscription ? (
        <CurrentPlanCard subscription={subscription} />
      ) : null}

      {/* Billing Portal button */}
      {hasSubscription && (
        <Button
          onClick={openBillingPortal}
          disabled={portalLoading}
          variant="outline"
          className="gap-2 w-full sm:w-auto"
        >
          {portalLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          Gerir Faturas e Assinatura
        </Button>
      )}

      {!hasSubscription && !subLoading && (
      ) : (
        <Card className="glass border-dashed border-muted-foreground/20">
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-muted-foreground text-sm">
              Ainda não tens um plano ativo.
            </p>
            <Button asChild variant="outline" className="gap-2">
              <a href={SITE_PRICING_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Ver Planos no Site
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick links to App-only purchases */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="glass hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate("/settings/credits")}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">AI Fuel</p>
              <p className="text-xs text-muted-foreground">Compra créditos de IA</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate("/domains")}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Domínios</p>
              <p className="text-xs text-muted-foreground">Regista o teu domínio</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
