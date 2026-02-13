import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Facebook, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget: number | null;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
}

interface MetaCampaignListProps {
  metaConnected: boolean;
}

function statusLabel(status: string): { label: string; variant: "default" | "secondary" | "outline" } {
  switch (status) {
    case "ACTIVE":
      return { label: "Ativa", variant: "default" };
    case "PAUSED":
      return { label: "Pausada", variant: "secondary" };
    default:
      return { label: status, variant: "outline" };
  }
}

export default function MetaCampaignList({ metaConnected }: MetaCampaignListProps) {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    if (!metaConnected) return;
    setLoading(true);
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("list-meta-campaigns");

    if (fnError) {
      setError(fnError.message);
    } else if (data && !data.success) {
      setError(data.error || "Erro desconhecido");
    } else if (data?.campaigns) {
      setCampaigns(data.campaigns);
    }
    setLoading(false);
  }, [metaConnected]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5" />
            Campanhas Meta Ads
          </CardTitle>
          {metaConnected && (
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCampaigns}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              {loading ? "A carregar..." : "Atualizar"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!metaConnected ? (
          <div className="text-center py-12 text-muted-foreground">
            <Facebook className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Meta Ads não conectado</p>
            <p className="text-sm mt-1">
              Conecta a tua conta Meta Ads no topo desta página.
            </p>
          </div>
        ) : loading && campaigns.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive opacity-70" />
            <p className="text-sm text-destructive font-medium">{error}</p>
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={fetchCampaigns}>
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Facebook className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Sem campanhas Meta Ads</p>
            <p className="text-sm mt-1">Não foram encontradas campanhas na tua conta.</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex gap-4 mb-4 text-sm text-muted-foreground border-b border-border pb-3">
              <span>{totalImpressions.toLocaleString()} impressões</span>
              <span>{totalClicks.toLocaleString()} cliques</span>
              <span>€{totalSpend.toFixed(2)} gasto total</span>
            </div>
            <div className="space-y-3">
              {campaigns.map((campaign) => {
                const { label, variant } = statusLabel(campaign.status);
                return (
                  <div
                    key={campaign.id}
                    className="p-4 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={variant}>{label}</Badge>
                          {campaign.objective && (
                            <span className="text-xs text-muted-foreground uppercase tracking-wider">
                              {campaign.objective.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium">{campaign.name}</p>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{campaign.impressions.toLocaleString()} impressões</span>
                          <span>{campaign.clicks.toLocaleString()} cliques</span>
                          <span>€{campaign.spend.toFixed(2)} gasto</span>
                          {campaign.daily_budget && (
                            <span>€{campaign.daily_budget.toFixed(2)}/dia</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
