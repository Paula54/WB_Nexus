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
  const [metaError, setMetaError] = useState<{
    message: string;
    user_msg?: string;
    user_title?: string;
    code?: number | string;
    type?: string;
    subcode?: number | string;
    fbtrace_id?: string;
    hint?: string;
    requires_wallet_topup?: boolean;
    wallet_balance?: number;
    required_amount?: number;
    missing_amount?: number;
    breakdown?: {
      daily_budget: number;
      days_pre_auth: number;
      total_budget: number;
      service_fee: number;
      markup_pct: number;
    };
    raw?: unknown;
  } | null>(null);
  const [toppingUp, setToppingUp] = useState(false);

  async function handleTopupWallet() {
    if (!metaError?.missing_amount) return;
    setToppingUp(true);
    try {
      const amount = Math.max(5, Math.ceil(metaError.missing_amount));
      const { data, error } = await supabase.functions.invoke("wallet-topup", {
        body: { amount: String(amount) },
      });
      if (error) throw new Error(error.message);
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("Sessão de pagamento inválida.");
    } catch (e) {
      console.error("topup error", e);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível iniciar o carregamento da Wallet.",
      });
    } finally {
      setToppingUp(false);
    }
  }

  function resetForm() {
    setStep("brief");
    setPlatform("meta");
    setDailyBudget("");
    setProduct("");
    setTargetAudience("");
    setAds([]);
    setAdCopy("");
    setMetaError(null);
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
    setMetaError(null);

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
        const { data: sessionData } = await supabase.auth.getSession();
        const response = await fetch(`${supabaseUrl}/functions/v1/publish-ad-campaign`, {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${sessionData.session?.access_token || supabaseAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            campaign_id: campaign.id,
            project_id: projectId,
            ad_copy: adCopy,
            daily_budget: parseFloat(dailyBudget) || 0,
            target_audience: targetAudience,
          }),
        });

        const publishResult = await response.json().catch(() => null);

        if (publishResult?.success) {
          toast({
            title: "🚀 Campanha publicada!",
            description: publishResult.message || `Debitámos ${publishResult.wallet_charged?.toFixed(2)}€ da tua Wallet Nexus.`,
          });
          handleOpenChange(false);
          onCreated();
          return;
        }

        // Failure — extract Meta detail or wallet topup
        const metaErr = publishResult?.meta_error || {};
        setMetaError({
          message: publishResult?.error || "Falha ao publicar a campanha.",
          user_msg: metaErr.error_user_msg,
          user_title: metaErr.error_user_title,
          code: metaErr.code,
          subcode: metaErr.error_subcode,
          type: metaErr.type,
          fbtrace_id: metaErr.fbtrace_id,
          hint: publishResult?.hint,
          requires_wallet_topup: publishResult?.requires_wallet_topup,
          wallet_balance: publishResult?.wallet_balance,
          required_amount: publishResult?.required_amount,
          missing_amount: publishResult?.missing_amount,
          breakdown: publishResult?.breakdown,
          raw: publishResult,
        });
        toast({
          variant: "destructive",
          title: publishResult?.requires_wallet_topup
            ? "💰 Saldo insuficiente na Wallet Nexus"
            : metaErr.error_user_title || "Erro ao publicar",
          description: publishResult?.error || metaErr.error_user_msg || "Ver detalhes abaixo.",
        });
        // Keep dialog open so user sees the detailed panel
      } catch (err: any) {
        console.error("Error publishing to Meta:", err);
        setMetaError({
          message: err?.message || "Erro de rede ao contactar a Edge Function.",
          raw: String(err),
        });
        toast({
          variant: "destructive",
          title: "Erro ao publicar",
          description: "Falha de comunicação. Ver detalhes abaixo.",
        });
      } finally {
        setPublishing(false);
      }
    } else {
      toast({ title: "Campanha criada com sucesso!" });
      handleOpenChange(false);
      onCreated();
    }
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

            {platform === "meta" && metaConnected && !metaError && dailyBudget && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                <p className="font-semibold text-primary">💰 Pré-autorização da Wallet Nexus</p>
                <p className="text-muted-foreground">
                  Orçamento: <strong>{(parseFloat(dailyBudget) || 0).toFixed(2)}€/dia × 7 dias</strong> = {((parseFloat(dailyBudget) || 0) * 7).toFixed(2)}€
                </p>
                <p className="text-muted-foreground">
                  Taxa de gestão (15%): <strong>{((parseFloat(dailyBudget) || 0) * 7 * 0.15).toFixed(2)}€</strong>
                </p>
                <p className="text-foreground pt-1 border-t border-primary/20">
                  Total a debitar: <strong className="text-primary">{((parseFloat(dailyBudget) || 0) * 7 * 1.15).toFixed(2)}€</strong>
                </p>
              </div>
            )}

            {metaError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-destructive">
                    {metaError.requires_wallet_topup
                      ? "💰 Saldo insuficiente na Wallet Nexus"
                      : metaError.user_title || "Erro ao publicar"}
                  </p>
                  {metaError.code !== undefined && (
                    <span className="text-[10px] text-destructive/80">
                      code: {String(metaError.code)}
                      {metaError.subcode ? ` / ${String(metaError.subcode)}` : ""}
                    </span>
                  )}
                </div>

                {metaError.requires_wallet_topup && metaError.breakdown && (
                  <div className="rounded bg-background/60 p-2 space-y-1 text-foreground">
                    <p>Saldo atual: <strong>{metaError.wallet_balance?.toFixed(2)}€</strong></p>
                    <p>Necessário: <strong>{metaError.required_amount?.toFixed(2)}€</strong> ({metaError.breakdown.daily_budget.toFixed(2)}€/dia × 7d + {metaError.breakdown.markup_pct}% taxa)</p>
                    <p className="text-destructive">Em falta: <strong>{metaError.missing_amount?.toFixed(2)}€</strong></p>
                  </div>
                )}

                {metaError.user_msg && (
                  <p className="text-foreground leading-relaxed">{metaError.user_msg}</p>
                )}
                {!metaError.requires_wallet_topup && (
                  <p className="text-muted-foreground">{metaError.message}</p>
                )}
                {metaError.hint && !metaError.requires_wallet_topup && (
                  <p className="text-primary">💡 {metaError.hint}</p>
                )}

                {metaError.requires_wallet_topup && (
                  <Button
                    onClick={handleTopupWallet}
                    disabled={toppingUp}
                    className="w-full mt-1 gap-2"
                    size="sm"
                  >
                    {toppingUp ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Carregar Wallet Nexus ({Math.max(5, Math.ceil(metaError.missing_amount || 5))}€)
                  </Button>
                )}

                {metaError.fbtrace_id && (
                  <p className="text-[10px] text-muted-foreground font-mono">
                    fbtrace_id: {metaError.fbtrace_id}
                  </p>
                )}
              </div>
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
