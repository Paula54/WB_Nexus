import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Check, Loader2, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AdCreative {
  headline: string;
  body: string;
  cta: string;
}

interface AdLabProps {
  locked: boolean;
  onCampaignLaunched: () => void;
}

export function AdLab({ locked, onCampaignLaunched }: AdLabProps) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [ads, setAds] = useState<AdCreative[]>([]);
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [publishing, setPublishing] = useState<number | null>(null);

  const generateAds = async () => {
    if (!product.trim()) { toast.error("Descreve o teu produto/serviço."); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ad-creatives", {
        body: { product: product.trim(), audience: audience.trim() },
      });
      if (error) throw error;
      setAds(data.ads || []);
      toast.success("3 anúncios gerados pela IA!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar anúncios. Tenta novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const approveAd = async (index: number, ad: AdCreative) => {
    if (!user) return;
    setPublishing(index);
    try {
      const { error } = await supabase.from("ads_campaigns").insert({
        user_id: user.id,
        platform: "meta",
        ad_copy: `${ad.headline}\n\n${ad.body}\n\n${ad.cta}`,
        status: "draft",
        daily_budget: 5,
      });
      if (error) throw error;
      toast.success("Campanha criada com sucesso! 🎉");
      onCampaignLaunched();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao criar campanha.");
    } finally {
      setPublishing(null);
    }
  };

  if (locked) {
    return (
      <Card className="border-2 border-muted/30 opacity-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <FlaskConical className="h-5 w-5" />
            Laboratório de Anúncios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            🔒 Liga as Redes Sociais e o WhatsApp primeiro para desbloquear.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-neon-purple/30 shadow-[0_0_20px_hsl(var(--neon-purple)/0.15)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-neon-purple" />
          <span className="text-neon-purple">Laboratório de Anúncios</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ads.length === 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>O que vendes ou ofereces?</Label>
              <Textarea placeholder="Ex: Bolos artesanais para eventos, casamentos e festas" value={product} onChange={(e) => setProduct(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Público-alvo <span className="text-muted-foreground">(opcional)</span></Label>
              <Input placeholder="Ex: Mulheres 25-45, Lisboa" value={audience} onChange={(e) => setAudience(e.target.value)} />
            </div>
            <Button onClick={generateAds} disabled={generating} className="w-full gap-2 bg-neon-purple hover:bg-neon-purple/90 text-white" size="lg">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "A gerar 3 anúncios..." : "Gerar 3 Anúncios com IA"}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {ads.map((ad, i) => (
              <Card key={i} className="border border-border bg-background/50">
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-display font-bold text-foreground text-sm">{ad.headline}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ad.body}</p>
                  <p className="text-xs font-medium text-neon-purple">{ad.cta}</p>
                  <Button
                    onClick={() => approveAd(i, ad)}
                    disabled={publishing !== null}
                    className="w-full gap-2 bg-neon-green hover:bg-neon-green/90 text-background font-bold"
                    size="sm"
                  >
                    {publishing === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Aprovar & Publicar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
