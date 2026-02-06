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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Sparkles } from "lucide-react";

interface CampaignCreateDialogProps {
  userId: string;
  metaConnected: boolean;
  projectId: string | null;
  onCreated: () => void;
}

export default function CampaignCreateDialog({
  userId,
  metaConnected,
  projectId,
  onCreated,
}: CampaignCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [platform, setPlatform] = useState<"meta" | "google">("meta");
  const [dailyBudget, setDailyBudget] = useState("");
  const [adCopy, setAdCopy] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

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

  async function createCampaign() {
    if (!adCopy.trim()) return;

    // Save to local DB first
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

    // If Meta is connected and platform is Meta, publish to Meta Ads
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
            description: publishResult?.error || "Campanha criada localmente, mas não foi publicada na Meta.",
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

    setOpen(false);
    resetForm();
    onCreated();
  }

  function resetForm() {
    setPlatform("meta");
    setDailyBudget("");
    setAdCopy("");
    setTargetAudience("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              placeholder="Escreve o texto do anúncio ou gere com IA..."
              value={adCopy}
              onChange={(e) => setAdCopy(e.target.value)}
              rows={5}
            />
          </div>

          {platform === "meta" && metaConnected && (
            <p className="text-xs text-primary flex items-center gap-1">
              ✅ A campanha será publicada diretamente na Meta Ads
            </p>
          )}

          <Button
            onClick={createCampaign}
            className="w-full"
            disabled={!adCopy.trim() || publishing}
          >
            {publishing ? "A publicar na Meta..." : "Criar Campanha"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
