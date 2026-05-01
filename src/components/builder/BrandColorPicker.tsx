import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Palette, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

export const DEFAULT_BRAND_COLORS: BrandColors = {
  primary: "#667eea",
  secondary: "#764ba2",
  accent: "#f59e0b",
};

const PRESETS: { name: string; colors: BrandColors }[] = [
  { name: "Royal", colors: { primary: "#667eea", secondary: "#764ba2", accent: "#f59e0b" } },
  { name: "Ocean", colors: { primary: "#0ea5e9", secondary: "#1e40af", accent: "#06b6d4" } },
  { name: "Forest", colors: { primary: "#16a34a", secondary: "#065f46", accent: "#84cc16" } },
  { name: "Sunset", colors: { primary: "#f97316", secondary: "#dc2626", accent: "#fbbf24" } },
  { name: "Mono", colors: { primary: "#111827", secondary: "#374151", accent: "#9ca3af" } },
  { name: "Rose", colors: { primary: "#ec4899", secondary: "#9d174d", accent: "#fda4af" } },
];

interface Props {
  projectId: string;
  value: BrandColors;
  onChange: (colors: BrandColors) => void;
}

export function BrandColorPicker({ projectId, value, onChange }: Props) {
  const { user } = useAuth();
  const [local, setLocal] = useState<BrandColors>(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const update = (key: keyof BrandColors, color: string) => {
    setLocal((prev) => ({ ...prev, [key]: color }));
  };

  const applyPreset = (colors: BrandColors) => {
    setLocal(colors);
  };

  const save = async () => {
    if (!user || !projectId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ brand_colors: local as any })
        .eq("id", projectId);
      if (error) throw error;
      onChange(local);
      toast.success("Paleta da marca guardada ✓");
    } catch (e: any) {
      toast.error("Erro ao guardar paleta: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    local.primary !== value.primary ||
    local.secondary !== value.secondary ||
    local.accent !== value.accent;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Palette className="h-5 w-5 text-primary" />
          Paleta da Marca
        </CardTitle>
        <CardDescription>
          Define as cores do teu site segundo o manual de identidade do negócio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {(["primary", "secondary", "accent"] as const).map((key) => (
            <div key={key} className="space-y-2">
              <Label className="capitalize text-xs">
                {key === "primary" ? "Principal" : key === "secondary" ? "Secundária" : "Destaque"}
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={local[key]}
                  onChange={(e) => update(key, e.target.value)}
                  className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer"
                />
                <Input
                  value={local[key]}
                  onChange={(e) => update(key, e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          ))}
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Presets rápidos</Label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p.colors)}
                className="group rounded-lg border border-border p-2 hover:border-primary transition-colors"
                title={p.name}
              >
                <div className="flex h-6 rounded overflow-hidden mb-1">
                  <div className="flex-1" style={{ background: p.colors.primary }} />
                  <div className="flex-1" style={{ background: p.colors.secondary }} />
                  <div className="flex-1" style={{ background: p.colors.accent }} />
                </div>
                <p className="text-[10px] text-center text-muted-foreground group-hover:text-foreground">
                  {p.name}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-20 rounded"
              style={{
                background: `linear-gradient(135deg, ${local.primary}, ${local.secondary})`,
              }}
            />
            <span className="text-xs text-muted-foreground">Pré-visualização</span>
          </div>
          <Button onClick={save} disabled={!dirty || saving} size="sm">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Guardar Paleta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
