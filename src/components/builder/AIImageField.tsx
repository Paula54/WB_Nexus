import { useEffect, useRef, useState } from "react";
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
import { Sparkles, Loader2, ImageIcon, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseCustom";
import { compressImage } from "@/lib/imageCompression";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  value: string;
  onChange: (url: string) => void;
  context?: "hero" | "feature" | "cta" | "background";
  label?: string;
}

const SECTOR_HINTS: Record<string, string> = {
  clinica: "modern medical clinic interior, clean, professional healthcare",
  restaurante: "elegant restaurant interior, warm lighting, gourmet food presentation",
  fitness: "modern gym, fitness training, athletic lifestyle",
  beleza: "luxury beauty salon, spa, cosmetic treatment",
  consultoria: "professional business meeting, corporate office, consulting",
  ecommerce: "modern e-commerce product photography, lifestyle",
  educacao: "modern classroom, learning environment, education",
  imobiliaria: "luxury real estate property, modern architecture",
  tecnologia: "tech office, software development, innovation",
  servicos: "professional services, modern workspace",
};

export function AIImageField({ value, onChange, context = "hero", label = "Imagem" }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [businessSector, setBusinessSector] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega o setor do utilizador para enriquecer prompt IA
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [project, profile] = await Promise.all([
        supabase.from("projects").select("business_sector").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle(),
        supabase.from("profiles").select("business_sector").eq("user_id", user.id).maybeSingle(),
      ]);
      const sector = (project.data as any)?.business_sector || profile.data?.business_sector;
      if (sector) setBusinessSector(sector);
    })();
  }, [user]);

  const generate = async () => {
    if (!prompt.trim() || prompt.trim().length < 3) {
      toast.error("Descreve a imagem com pelo menos 3 caracteres");
      return;
    }
    setLoading(true);
    try {
      const sectorHint = businessSector ? SECTOR_HINTS[businessSector] || businessSector : "";
      const enrichedPrompt = sectorHint
        ? `${prompt.trim()}. Style context: ${sectorHint}.`
        : prompt.trim();

      const { data, error } = await supabase.functions.invoke("generate-site-image", {
        body: { prompt: enrichedPrompt, context },
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
      toast.error(e?.message || "Erro a gerar imagem");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) {
      toast.error("Sessão inválida");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem demasiado grande (máx. 10MB)");
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(file, "product_image");
      const ext = (compressed.name.split(".").pop() || "webp").toLowerCase();
      const path = `${user.id}/${context}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("site-images")
        .upload(path, compressed, { contentType: compressed.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("site-images").getPublicUrl(path);
      onChange(pub.publicUrl);
      toast.success("Foto carregada ✓");
    } catch (err: any) {
      console.error("[AIImageField] upload error:", err);
      toast.error(err?.message || "Erro a carregar foto");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {/* Preview */}
      {value ? (
        <div className="relative rounded-lg border overflow-hidden bg-muted/20">
          <img
            src={value}
            alt="Preview"
            className="w-full h-40 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-primary/30 bg-primary/5 text-muted-foreground text-xs gap-2">
          <ImageIcon className="h-4 w-4" />
          Sem imagem · escolhe abaixo
        </div>
      )}

      {/* URL manual (subtle) */}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ou cola URL https://..."
        className="text-xs h-8"
      />

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Upload Foto
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="default"
              className="w-full bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Gerar com IA
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
              {businessSector && (
                <div className="text-xs text-muted-foreground bg-primary/10 rounded-md p-2 border border-primary/20">
                  ✨ A IA vai adaptar a imagem ao teu setor: <strong>{businessSector}</strong>
                </div>
              )}
              <div className="space-y-2">
                <Label>Descreve a imagem que queres</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ex: Interior moderno com luz natural e plantas"
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
    </div>
  );
}
