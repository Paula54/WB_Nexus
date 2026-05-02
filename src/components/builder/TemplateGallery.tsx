import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, LayoutTemplate, Eye } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { TemplatePreviewModal } from "./TemplatePreviewModal";

interface TemplateRow {
  id: string;
  title: string;
  template_name: string | null;
  template_description: string | null;
  template_sector: string | null;
  content: any;
}

interface Props {
  projectId: string;
  pageId: string;
  onApplied: () => void;
}

const SECTOR_META: Record<string, { label: string; emoji: string; gradient: string }> = {
  clinica: { label: "Clínica / Saúde", emoji: "🏥", gradient: "from-sky-500 to-cyan-400" },
  restaurante: { label: "Restaurante", emoji: "🍽️", gradient: "from-amber-500 to-red-500" },
  cafetaria: { label: "Cafetaria", emoji: "☕", gradient: "from-amber-700 to-orange-400" },
  advocacia: { label: "Advocacia", emoji: "⚖️", gradient: "from-slate-700 to-slate-500" },
  imobiliaria: { label: "Imobiliária", emoji: "🏡", gradient: "from-emerald-600 to-teal-400" },
  salao_beleza: { label: "Salão de Beleza", emoji: "💅", gradient: "from-pink-500 to-fuchsia-400" },
  fitness: { label: "Fitness", emoji: "💪", gradient: "from-orange-500 to-red-500" },
  loja_roupa: { label: "Loja de Roupa", emoji: "👗", gradient: "from-violet-500 to-purple-400" },
  generic: { label: "Genérico", emoji: "✨", gradient: "from-primary to-accent" },
};

function getSectorMeta(sector?: string | null) {
  if (!sector) return SECTOR_META.generic;
  return SECTOR_META[sector] ?? { label: sector, emoji: "✨", gradient: "from-primary to-accent" };
}

/** Extrai dados úteis do conteúdo do modelo para construir um preview visual. */
function extractPreview(content: any) {
  const sections = Array.isArray(content?.sections) ? content.sections : [];
  const hero = sections.find((s: any) => s.type === "hero");
  const features = sections.find((s: any) => s.type === "features");
  const testimonials = sections.find((s: any) => s.type === "testimonials");

  return {
    heroTitle: hero?.content?.title || content?.title || "Título do Site",
    heroSubtitle: hero?.content?.subtitle || "Subtítulo de exemplo",
    heroCta: hero?.content?.buttonText || "Começar",
    heroImage: hero?.content?.backgroundImage as string | undefined,
    featuresTitle: features?.content?.title,
    featureItems: (features?.content?.items || []).slice(0, 3) as Array<{ title?: string }>,
    hasTestimonials: !!testimonials,
    sectionCount: sections.length,
  };
}

function TemplatePreview({ tpl }: { tpl: TemplateRow }) {
  const meta = getSectorMeta(tpl.template_sector);
  const p = extractPreview(tpl.content);

  return (
    <div className="relative w-full aspect-[16/10] overflow-hidden rounded-md border bg-background">
      {/* Browser chrome */}
      <div className="flex items-center gap-1 px-2 py-1 bg-muted/60 border-b">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
      </div>

      {/* Hero mock */}
      <div
        className={`relative h-[58%] bg-gradient-to-br ${meta.gradient} flex flex-col items-center justify-center text-white text-center px-3`}
        style={
          p.heroImage
            ? {
                backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${p.heroImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="text-[10px] font-bold leading-tight line-clamp-2 drop-shadow">
          {p.heroTitle}
        </div>
        <div className="text-[8px] opacity-90 mt-0.5 line-clamp-1 drop-shadow">
          {p.heroSubtitle}
        </div>
        <div className="mt-1 px-2 py-0.5 rounded-full bg-white/95 text-[7px] font-semibold text-black">
          {p.heroCta}
        </div>
      </div>

      {/* Features mock */}
      <div className="px-2 py-1.5">
        {p.featuresTitle && (
          <div className="text-[8px] font-semibold text-foreground/80 line-clamp-1 mb-1 text-center">
            {p.featuresTitle}
          </div>
        )}
        <div className="grid grid-cols-3 gap-1">
          {(p.featureItems.length > 0
            ? p.featureItems
            : [{ title: "•" }, { title: "•" }, { title: "•" }]
          ).map((f, i) => (
            <div
              key={i}
              className="rounded bg-muted/70 h-5 flex items-center justify-center text-[7px] text-foreground/70 px-1 line-clamp-1"
            >
              {f.title || "•"}
            </div>
          ))}
        </div>
      </div>

      {/* Sector chip */}
      <div className="absolute top-1.5 right-1.5">
        <span className="px-1.5 py-0.5 rounded bg-black/40 text-white text-[8px] backdrop-blur-sm">
          {meta.emoji} {meta.label}
        </span>
      </div>
    </div>
  );
}

export function TemplateGallery({ projectId, pageId, onApplied }: Props) {
  const { profile } = useProfile();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("pages")
        .select("id, title, template_name, template_description, template_sector, content")
        .eq("is_template", true)
        .order("template_sector", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("[TemplateGallery] load error:", error);
        toast.error("Erro a carregar modelos");
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        try {
          const { data: seedData, error: seedErr } = await supabase.functions.invoke("seed-templates");
          if (seedErr) throw seedErr;
          if (seedData?.error) throw new Error(seedData.error);
          const { data: refreshed } = await supabase
            .from("pages")
            .select("id, title, template_name, template_description, template_sector, content")
            .eq("is_template", true)
            .order("template_sector", { ascending: true });
          if (!cancelled) setTemplates((refreshed ?? []) as TemplateRow[]);
        } catch (e: any) {
          console.error("[TemplateGallery] auto-seed error:", e);
          if (!cancelled) setTemplates([]);
        }
      } else {
        setTemplates(data as TemplateRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pré-selecionar o setor do utilizador, se houver match
  useEffect(() => {
    if (!profile?.business_sector || templates.length === 0) return;
    const hasMatch = templates.some((t) => t.template_sector === profile.business_sector);
    if (hasMatch) setSectorFilter(profile.business_sector);
  }, [profile?.business_sector, templates]);

  const availableSectors = useMemo(
    () =>
      Array.from(new Set(templates.map((t) => t.template_sector).filter(Boolean) as string[])).sort(),
    [templates]
  );

  const filteredTemplates = useMemo(
    () => templates.filter((t) => sectorFilter === "all" || t.template_sector === sectorFilter),
    [templates, sectorFilter]
  );

  const applyTemplate = async (templateId: string) => {
    setApplyingId(templateId);
    try {
      const { data, error } = await supabase.functions.invoke("clone-template", {
        body: { templateId, targetPageId: pageId, projectId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Modelo aplicado e personalizado ✨");
      onApplied();
    } catch (e: any) {
      console.error("[TemplateGallery] apply error:", e);
      toast.error(e?.message || "Erro ao aplicar modelo");
    } finally {
      setApplyingId(null);
    }
  };

  const seedTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-templates");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Modelos prontos (${data?.created?.length ?? 0} novos)`);
      const { data: refreshed } = await supabase
        .from("pages")
        .select("id, title, template_name, template_description, template_sector, content")
        .eq("is_template", true)
        .order("template_sector", { ascending: true });
      setTemplates((refreshed ?? []) as TemplateRow[]);
    } catch (e: any) {
      console.error("[TemplateGallery] seed error:", e);
      toast.error(e?.message || "Erro a preparar modelos");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="py-12 text-center">
          <LayoutTemplate className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
          <p className="text-muted-foreground">Ainda não existem modelos disponíveis.</p>
          <p className="text-sm mt-2 mb-6 text-muted-foreground">
            Carrega abaixo para preparar a galeria inicial.
          </p>
          <Button onClick={seedTemplates}>
            <Sparkles className="h-4 w-4 mr-2" />
            Preparar Modelos Iniciais
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-display font-bold flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Modelos Inteligentes
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Escolhe o tipo de negócio e seleciona um modelo. A IA personaliza-o automaticamente.
        </p>
      </div>

      {/* Selector visual de setor */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 max-w-md mx-auto">
        <label className="text-sm text-muted-foreground shrink-0">Tipo de negócio:</label>
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {sectorFilter === "all" ? (
                <span className="flex items-center gap-2">
                  <span>🗂️</span> Todos os setores
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>{getSectorMeta(sectorFilter).emoji}</span>
                  {getSectorMeta(sectorFilter).label}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <span className="flex items-center gap-2">🗂️ Todos os setores</span>
            </SelectItem>
            {availableSectors.map((s) => {
              const m = getSectorMeta(s);
              return (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-2">
                    <span>{m.emoji}</span> {m.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {filteredTemplates.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Sem modelos para este setor. Tenta outro.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => {
            const meta = getSectorMeta(tpl.template_sector);
            const isApplying = applyingId === tpl.id;
            return (
              <Card
                key={tpl.id}
                className="glass overflow-hidden hover:border-primary/60 hover:shadow-lg transition-all group"
              >
                <div className="p-3">
                  <TemplatePreview tpl={tpl} />
                </div>
                <CardContent className="pt-0 pb-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {tpl.template_name || tpl.title}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {tpl.template_description || "Modelo profissional pronto a personalizar."}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {meta.emoji} {meta.label}
                    </Badge>
                  </div>

                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => applyTemplate(tpl.id)}
                    disabled={applyingId !== null}
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        A personalizar…
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Usar este modelo
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
