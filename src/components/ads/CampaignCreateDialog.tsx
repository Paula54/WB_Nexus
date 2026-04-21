import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent } from "@/components/ui/card";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabaseCustom";
import { toast } from "@/hooks/use-toast";
import { Plus, Sparkles, Loader2, ArrowLeft } from "lucide-react";

interface CampaignCreateDialogProps {
  userId: string;
  metaConnected: boolean;
  projectId: string | null;
  onCreated: () => void;
}

interface AdCreative {
  headline: string;
  body: string;
  cta: string;
}

type Step = "brief" | "choose" | "review";

export default function CampaignCreateDialog({
  userId,
  metaConnected,
  projectId,
  onCreated,
}: CampaignCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("brief");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [platform, setPlatform] = useState<"meta" | "google">("meta");
  const [dailyBudget, setDailyBudget] = useState("");
  const [product, setProduct] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [ads, setAds] = useState<AdCreative[]>([]);
  const [adCopy, setAdCopy] = useState("");

  function resetForm() {
    setStep("brief");
    setPlatform("meta");
    setDailyBudget("");
    setProduct("");
    setTargetAudience("");
    setAds([]);
    setAdCopy("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  async function generateAds() {
    if (!product.trim()) {
      toast({ variant: "destructive", title: "Descreve o teu produto/serviço." });
      return;
    }
    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-ad-creatives`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${sessionData.session?.access_token || supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product: product.trim(), audience: targetAudience.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "A função de IA não respondeu.");
      const generated: AdCreative[] = data?.ads || [];
      if (generated.length === 0) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data?.error || "A IA não devolveu anúncios. Tenta novamente.",
        });
        return;
      }
      setAds(generated);
      setStep("choose");
      toast({ title: `${generated.length} anúncios gerados pela IA!` });
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível gerar os anúncios.",
      });
    } finally {
      setGenerating(false);
    }
  }

  function chooseAd(ad: AdCreative) {
    setAdCopy(`${ad.headline}\n\n${ad.body}\n\n${ad.cta}`);
    setStep("review");
  }

  async function createCampaign() {
    if (!adCopy.trim()) return;

    const { data: campaign, error } = await supabase
      .from("ads_campaigns")
      .insert({
        user_id: userId,
        platform,
        daily_budget: parseFloat(dailyBudget) || 0,
        ad_copy: adCopy,
        target_audience: targetAudience,
        status: "paused",
        project_id: projectId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating campaign:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível criar a campanha.",
      });
      return;
    }

    if (platform === "meta" && metaConnected && projectId) {
      setPublishing(true);
      try {
        const { data: publishResult, error: publishError } = await supabase.functions.invoke(
          "publish-ad-campaign",
          {
            body: {
              campaign_id: campaign.id,
              project_id: projectId,
              ad_copy: adCopy,
              daily_budget: parseFloat(dailyBudget) || 0,
              target_audience: targetAudience,
            },
          }
        );

        if (publishError) throw publishError;

        if (publishResult?.success) {
          toast({ title: "🚀 Campanha publicada na Meta Ads!" });
        } else {
          toast({
            variant: "destructive",
            title: "Aviso",
            description:
              publishResult?.error || "Campanha criada localmente, mas não publicada na Meta.",
          });
        }
      } catch (err) {
        console.error("Error publishing to Meta:", err);
        toast({
          variant: "destructive",
          title: "Erro ao publicar",
          description: "Campanha criada localmente. Erro ao publicar na Meta Ads.",
        });
      } finally {
        setPublishing(false);
      }
    } else {
      toast({ title: "Campanha criada com sucesso!" });
    }

    handleOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "brief" && "Criar Nova Campanha"}
            {step === "choose" && "Escolhe o teu anúncio"}
            {step === "review" && "Rever e Publicar"}
          </DialogTitle>
        </DialogHeader>

        {step === "brief" && (
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Select
                  value={platform}
                  onValueChange={(v) => setPlatform(v as "meta" | "google")}
                >
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
              <Label>O que vendes ou ofereces?</Label>
              <Textarea
                placeholder="Ex: Bolos artesanais para eventos, casamentos e festas"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Público-Alvo <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                placeholder="Ex: Mulheres 25-45, Lisboa"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>

            <Button
              onClick={generateAds}
              disabled={generating || !product.trim()}
              className="w-full gap-2"
              size="lg"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating ? "A gerar 3 anúncios..." : "Gerar 3 Anúncios com IA"}
            </Button>
          </div>
        )}

        {step === "choose" && (
          <div className="space-y-4 mt-4">
            <div className="grid gap-3">
              {ads.map((ad, i) => (
                <Card
                  key={i}
                  className="border border-border bg-background/50 hover:border-primary/50 transition-colors"
                >
                  <CardContent className="p-4 space-y-2">
                    <h4 className="font-display font-bold text-foreground text-sm">
                      {ad.headline}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{ad.body}</p>
                    <p className="text-xs font-medium text-primary">{ad.cta}</p>
                    <Button
                      onClick={() => chooseAd(ad)}
                      className="w-full mt-2"
                      size="sm"
                      variant="outline"
                    >
                      Escolher este
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("brief")}
              className="gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar
            </Button>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Texto do Anúncio (podes editar)</Label>
              <Textarea
                value={adCopy}
                onChange={(e) => setAdCopy(e.target.value)}
                rows={6}
              />
            </div>

            {platform === "meta" && metaConnected && (
              <p className="text-xs text-primary flex items-center gap-1">
                ✅ A campanha será publicada diretamente na Meta Ads
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("choose")}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button
                onClick={createCampaign}
                className="flex-1"
                disabled={!adCopy.trim() || publishing}
              >
                {publishing ? "A publicar na Meta..." : "Criar Campanha"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
