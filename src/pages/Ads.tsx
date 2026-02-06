import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Megaphone,
  Plus,
  TrendingUp,
  MousePointer,
  Eye,
  DollarSign,
  Sparkles,
  Play,
  Pause,
  Trash2,
} from "lucide-react";
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

export default function Ads() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [platform, setPlatform] = useState<"meta" | "google">("meta");
  const [dailyBudget, setDailyBudget] = useState("");
  const [adCopy, setAdCopy] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  useEffect(() => {
    fetchCampaigns();
  }, [user]);

  async function fetchCampaigns() {
    if (!user) return;

    const { data, error } = await supabase
      .from("ads_campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching campaigns:", error);
    } else {
      setCampaigns((data as Campaign[]) || []);
    }
    setLoading(false);
  }

  async function createCampaign() {
    if (!user || !adCopy.trim()) return;

    const { error } = await supabase.from("ads_campaigns").insert({
      user_id: user.id,
      platform,
      daily_budget: parseFloat(dailyBudget) || 0,
      ad_copy: adCopy,
      target_audience: targetAudience,
      status: "paused",
    });

    if (error) {
      console.error("Error creating campaign:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível criar a campanha.",
      });
    } else {
      toast({ title: "Campanha criada com sucesso!" });
      setIsDialogOpen(false);
      resetForm();
      fetchCampaigns();
    }
  }

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
      fetchCampaigns();
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
      fetchCampaigns();
    }
  }

  async function generateWithAI() {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("nexus-concierge", {
        body: {
          message: `Gera um texto de anúncio profissional para uma campanha de ${platform === "meta" ? "Facebook/Instagram" : "Google Ads"}. 
          O anúncio deve ser persuasivo, ter um CTA claro e focar em conversões. 
          Público-alvo: ${targetAudience || "Empresários e profissionais interessados em tecnologia"}.
          Retorna apenas o texto do anúncio, sem explicações.`,
          context: { type: "ad_generation" },
        },
      });

      if (error) throw error;
      
      if (data?.response) {
        setAdCopy(data.response);
        toast({ title: "Texto gerado com sucesso!" });
      }
    } catch (error) {
      console.error("Error generating ad copy:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível gerar o texto.",
      });
    } finally {
      setGenerating(false);
    }
  }

  function resetForm() {
    setPlatform("meta");
    setDailyBudget("");
    setAdCopy("");
    setTargetAudience("");
  }

  // Calculate totals
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.metrics?.impressions || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.metrics?.clicks || 0), 0);
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.metrics?.spend || 0), 0);
  const costPerLead = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : "0.00";
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Anúncios</h1>
          <p className="text-muted-foreground mt-1">
            Motor de Tráfego — Gestão de campanhas publicitárias
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar Nova Campanha</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select value={platform} onValueChange={(v) => setPlatform(v as "meta" | "google")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meta">Meta (Facebook/Instagram)</SelectItem>
                      <SelectItem value="google">Google Ads</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Orçamento Diário (€)</Label>
                  <Input
                    type="number"
                    placeholder="50"
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Público-Alvo</Label>
                <Input
                  placeholder="Ex: Empresários, 25-45 anos, interessados em marketing"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Texto do Anúncio</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateWithAI}
                    disabled={generating}
                    className="gap-1 text-primary"
                  >
                    <Sparkles className="h-3 w-3" />
                    {generating ? "A gerar..." : "Gerar com IA"}
                  </Button>
                </div>
                <Textarea
                  placeholder="Escreva o texto do anúncio ou gere com IA..."
                  value={adCopy}
                  onChange={(e) => setAdCopy(e.target.value)}
                  rows={5}
                />
              </div>

              <Button onClick={createCampaign} className="w-full" disabled={!adCopy.trim()}>
                Criar Campanha
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Impressões</p>
                <p className="text-2xl font-bold">{totalImpressions.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Eye className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cliques</p>
                <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">CTR: {ctr}%</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-accent/30 flex items-center justify-center">
                <MousePointer className="h-6 w-6 text-accent-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Custo por Lead</p>
                <p className="text-2xl font-bold">€{costPerLead}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-secondary/30 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-secondary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gasto Total</p>
                <p className="text-2xl font-bold">€{totalSpend.toFixed(2)}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
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
    </div>
  );
}
