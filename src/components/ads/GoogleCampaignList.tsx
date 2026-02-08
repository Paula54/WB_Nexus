import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Globe, AlertCircle, Settings } from "lucide-react";
import { GoogleCampaign } from "@/hooks/useGoogleAdsCampaigns";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface GoogleCampaignListProps {
  campaigns: GoogleCampaign[];
  loading: boolean;
  syncing: boolean;
  connected: boolean;
  customerIdMissing: boolean;
  error: string | null;
  onSync: () => void;
}

function formatMicros(micros: string | number): string {
  const value = typeof micros === "string" ? parseInt(micros) : micros;
  return (value / 1_000_000).toFixed(2);
}

function statusLabel(status: string): { label: string; variant: "default" | "secondary" | "outline" } {
  switch (status) {
    case "ENABLED":
      return { label: "Ativa", variant: "default" };
    case "PAUSED":
      return { label: "Pausada", variant: "secondary" };
    case "REMOVED":
      return { label: "Removida", variant: "outline" };
    default:
      return { label: status, variant: "outline" };
  }
}

export default function GoogleCampaignList({
  campaigns,
  loading,
  syncing,
  connected,
  customerIdMissing,
  error,
  onSync,
}: GoogleCampaignListProps) {
  const navigate = useNavigate();

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Campanhas Google Ads
          </CardTitle>
          {connected && !customerIdMissing && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={syncing || loading}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? "A sincronizar..." : "Sincronizar Agora"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!connected ? (
          <div className="text-center py-12 text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Google Ads não conectado</p>
            <p className="text-sm mt-1">
              Vai a <span className="text-primary cursor-pointer" onClick={() => navigate("/settings")}>Definições</span> para ligar a tua conta Google Ads.
            </p>
          </div>
        ) : customerIdMissing ? (
          <div className="text-center py-12 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Customer ID não configurado</p>
            <p className="text-sm mt-1">
              Vai a <span className="text-primary cursor-pointer" onClick={() => navigate("/settings")}>Definições</span> e define o Customer ID (formato XXX-XXX-XXXX).
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive opacity-70" />
            <p className="text-sm text-destructive font-medium">{error}</p>
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={onSync}>
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Conta ligada, sem campanhas</p>
            <p className="text-sm mt-1">
              A tua conta está ligada, mas ainda não tens campanhas Google Ads.
            </p>
          </div>
        ) : (
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
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">
                          {campaign.channel_type?.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{campaign.name}</p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{parseInt(campaign.impressions || "0").toLocaleString()} impressões</span>
                        <span>{parseInt(campaign.clicks || "0").toLocaleString()} cliques</span>
                        <span>€{formatMicros(campaign.cost_micros || "0")} gasto</span>
                        {campaign.budget_micros && (
                          <span>€{formatMicros(campaign.budget_micros)}/dia</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
