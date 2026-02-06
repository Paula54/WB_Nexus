import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Megaphone, Play, Pause, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string;
  platform: "meta" | "google";
  daily_budget: number;
  status: "active" | "paused" | "completed";
  ad_copy: string | null;
  target_audience: string | null;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
  };
  created_at: string;
}

interface CampaignListProps {
  campaigns: Campaign[];
  loading: boolean;
  onRefresh: () => void;
}

export default function CampaignList({ campaigns, loading, onRefresh }: CampaignListProps) {
  async function toggleStatus(campaign: Campaign) {
    const newStatus = campaign.status === "active" ? "paused" : "active";

    const { error } = await supabase
      .from("ads_campaigns")
      .update({ status: newStatus })
      .eq("id", campaign.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar o status.",
      });
    } else {
      onRefresh();
    }
  }

  async function deleteCampaign(id: string) {
    const { error } = await supabase.from("ads_campaigns").delete().eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível eliminar a campanha.",
      });
    } else {
      toast({ title: "Campanha eliminada" });
      onRefresh();
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Campanhas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Sem campanhas ativas</p>
            <p className="text-sm">Crie a primeira campanha para começar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="p-4 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={campaign.platform === "meta" ? "default" : "secondary"}>
                        {campaign.platform === "meta" ? "Meta" : "Google"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          campaign.status === "active"
                            ? "border-primary text-primary"
                            : "border-muted-foreground"
                        )}
                      >
                        {campaign.status === "active" ? "Ativo" : "Pausado"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        €{campaign.daily_budget}/dia
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2">{campaign.ad_copy}</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{campaign.metrics?.impressions || 0} impressões</span>
                      <span>{campaign.metrics?.clicks || 0} cliques</span>
                      <span>€{(campaign.metrics?.spend || 0).toFixed(2)} gasto</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleStatus(campaign)}
                      title={campaign.status === "active" ? "Pausar" : "Ativar"}
                    >
                      {campaign.status === "active" ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteCampaign(campaign.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
