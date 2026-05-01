import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Type, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface BrandFonts {
  heading: string;
  body: string;
}

export const DEFAULT_BRAND_FONTS: BrandFonts = {
  heading: "Inter",
  body: "Inter",
};

// Curated Google Fonts list — loaded on demand
export const FONT_OPTIONS: { value: string; label: string; category: string }[] = [
  { value: "Inter", label: "Inter (Moderno)", category: "sans-serif" },
  { value: "Poppins", label: "Poppins (Geométrico)", category: "sans-serif" },
  { value: "Montserrat", label: "Montserrat (Premium)", category: "sans-serif" },
  { value: "Roboto", label: "Roboto (Clássico)", category: "sans-serif" },
  { value: "Open Sans", label: "Open Sans (Legível)", category: "sans-serif" },
  { value: "Lato", label: "Lato (Suave)", category: "sans-serif" },
  { value: "Raleway", label: "Raleway (Elegante)", category: "sans-serif" },
  { value: "Nunito", label: "Nunito (Amigável)", category: "sans-serif" },
  { value: "Work Sans", label: "Work Sans (Profissional)", category: "sans-serif" },
  { value: "DM Sans", label: "DM Sans (Minimalista)", category: "sans-serif" },
  { value: "Playfair Display", label: "Playfair Display (Editorial)", category: "serif" },
  { value: "Merriweather", label: "Merriweather (Jornalístico)", category: "serif" },
  { value: "Lora", label: "Lora (Clássico Serif)", category: "serif" },
  { value: "Cormorant Garamond", label: "Cormorant (Luxo)", category: "serif" },
  { value: "Oswald", label: "Oswald (Impactante)", category: "display" },
  { value: "Bebas Neue", label: "Bebas Neue (Condensado)", category: "display" },
  { value: "Dancing Script", label: "Dancing Script (Manuscrito)", category: "handwriting" },
  { value: "Pacifico", label: "Pacifico (Casual)", category: "handwriting" },
];

const PRESETS: { name: string; fonts: BrandFonts; desc: string }[] = [
  { name: "Moderno", fonts: { heading: "Poppins", body: "Inter" }, desc: "Tech / SaaS" },
  { name: "Editorial", fonts: { heading: "Playfair Display", body: "Lora" }, desc: "Conteúdo / Blog" },
  { name: "Premium", fonts: { heading: "Montserrat", body: "Open Sans" }, desc: "Corporativo" },
  { name: "Impacto", fonts: { heading: "Bebas Neue", body: "Work Sans" }, desc: "Eventos / Fitness" },
  { name: "Suave", fonts: { heading: "Raleway", body: "Nunito" }, desc: "Wellness / Beauty" },
  { name: "Luxo", fonts: { heading: "Cormorant Garamond", body: "Lato" }, desc: "Boutique / Hotelaria" },
];

// Inject Google Fonts link once per font family
const loadedFonts = new Set<string>();
export function loadGoogleFont(family: string) {
  if (!family || loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

interface Props {
  projectId: string;
  value: BrandFonts;
  onChange: (fonts: BrandFonts) => void;
}

export function BrandFontPicker({ projectId, value, onChange }: Props) {
  const { user } = useAuth();
  const [local, setLocal] = useState<BrandFonts>(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => setLocal(value), [value]);

  // Preload selected fonts for live preview
  useEffect(() => {
    loadGoogleFont(local.heading);
    loadGoogleFont(local.body);
  }, [local]);

  const update = (key: keyof BrandFonts, font: string) => {
    setLocal((prev) => ({ ...prev, [key]: font }));
    loadGoogleFont(font);
  };

  const applyPreset = (fonts: BrandFonts) => {
    setLocal(fonts);
    loadGoogleFont(fonts.heading);
    loadGoogleFont(fonts.body);
  };

  const save = async () => {
    if (!user || !projectId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ brand_fonts: local as any })
        .eq("id", projectId);
      if (error) throw error;
      onChange(local);
      toast.success("Tipografia da marca guardada ✓");
    } catch (e: any) {
      toast.error("Erro ao guardar tipografia: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const dirty = local.heading !== value.heading || local.body !== value.body;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Type className="h-4 w-4 text-primary" /> Tipografia da Marca
        </CardTitle>
        <CardDescription>
          Escolhe os tipos de letra do manual de identidade do teu negócio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Presets */}
        <div>
          <Label className="text-xs text-muted-foreground">Presets</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1.5">
            {PRESETS.map((p) => (
              <Button
                key={p.name}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto py-2 flex-col items-start"
                onClick={() => applyPreset(p.fonts)}
              >
                <span
                  className="text-sm font-semibold"
                  style={{ fontFamily: `'${p.fonts.heading}', sans-serif` }}
                >
                  {p.name}
                </span>
                <span className="text-[10px] text-muted-foreground">{p.desc}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Heading font */}
        <div className="space-y-1.5">
          <Label className="text-xs">Títulos (Headings)</Label>
          <Select value={local.heading} onValueChange={(v) => update("heading", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {FONT_OPTIONS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  <span style={{ fontFamily: `'${f.value}', ${f.category}` }}>{f.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div
            className="rounded-md border p-3 bg-background"
            style={{ fontFamily: `'${local.heading}', sans-serif` }}
          >
            <p className="text-xl font-bold">O teu título aparece assim</p>
          </div>
        </div>

        {/* Body font */}
        <div className="space-y-1.5">
          <Label className="text-xs">Corpo de Texto</Label>
          <Select value={local.body} onValueChange={(v) => update("body", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {FONT_OPTIONS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  <span style={{ fontFamily: `'${f.value}', ${f.category}` }}>{f.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div
            className="rounded-md border p-3 bg-background text-sm"
            style={{ fontFamily: `'${local.body}', sans-serif` }}
          >
            O teu corpo de texto aparece assim — legibilidade e personalidade da marca em cada parágrafo.
          </div>
        </div>

        <Button onClick={save} disabled={!dirty || saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Guardar Tipografia
        </Button>
      </CardContent>
    </Card>
  );
}
