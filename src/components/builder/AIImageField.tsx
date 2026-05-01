import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sparkles, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseCustom";

interface Props {
  value: string;
  onChange: (url: string) => void;
  context?: "hero" | "feature" | "cta" | "background";
  label?: string;
}

export function AIImageField({ value, onChange, context = "hero", label = "URL da Imagem" }: Props) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!prompt.trim() || prompt.trim().length < 3) {
      toast.error("Descreve a imagem com pelo menos 3 caracteres");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-site-image", {
        body: { prompt: prompt.trim(), context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("Sem imagem devolvida");
      onChange(data.url);
      toast.success(`Imagem gerada (custou ${data.cost} créditos) ✨`);
      setOpen(false);
      setPrompt("");
    } catch (e: any) {
      console.error("[AIImageField] generate error:", e);
      const msg = e?.message || "Erro a gerar imagem";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... ou gera com IA →"
          className="flex-1"
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="icon" title="Gerar com IA">
              <Sparkles className="h-4 w-4 text-primary" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Gerar imagem com IA
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Descreve a imagem que queres</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ex: Interior moderno de uma clínica, luz natural, plantas, recepção minimalista"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {prompt.length}/500 · Custo: 5 créditos AI Fuel
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={generate} disabled={loading || !prompt.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />A gerar…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {value && (
        <div className="relative rounded-lg border overflow-hidden bg-muted/20">
          <img
            src={value}
            alt="Preview"
            className="w-full h-32 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      {!value && (
        <div className="flex items-center justify-center h-20 rounded-lg border border-dashed text-muted-foreground text-xs gap-2">
          <ImageIcon className="h-4 w-4" />
          Sem imagem
        </div>
      )}
    </div>
  );
}
