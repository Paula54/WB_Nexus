import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, LayoutTemplate, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface TemplateRow {
  id: string;
  title: string;
  template_name: string | null;
  template_description: string | null;
  template_sector: string | null;
  content: Record<string, unknown>;
}

interface Props {
  projectId: string;
  pageId: string;
  onApplied: () => void;
}

const SECTOR_LABELS: Record<string, string> = {
  clinica: "Clínica / Saúde",
  restaurante: "Restaurante",
  cafetaria: "Cafetaria",
  advocacia: "Advocacia",
  imobiliaria: "Imobiliária",
  salao_beleza: "Salão de Beleza",
  fitness: "Fitness",
  loja_roupa: "Loja de Roupa",
  generic: "Genérico",
};

export function TemplateGallery({ projectId, pageId, onApplied }: Props) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);

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
      } else {
        setTemplates((data ?? []) as TemplateRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const seedTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-templates");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Modelos prontos (${data?.created?.length ?? 0} novos)`);
      // recarregar
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
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-display font-bold flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Modelos Inteligentes
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Escolhe um modelo. A IA vai personalizá-lo com os dados do teu negócio.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tpl) => {
          const sectorLabel = tpl.template_sector
            ? SECTOR_LABELS[tpl.template_sector] || tpl.template_sector
            : "Genérico";
          return (
            <Card key={tpl.id} className="glass hover:border-primary/50 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{tpl.template_name || tpl.title}</CardTitle>
                  <Badge variant="secondary" className="shrink-0">
                    {sectorLabel}
                  </Badge>
                </div>
                <CardDescription className="text-xs line-clamp-2">
                  {tpl.template_description || "Modelo profissional pronto a personalizar."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => applyTemplate(tpl.id)}
                  disabled={applyingId !== null}
                >
                  {applyingId === tpl.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />A personalizar…
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
    </div>
  );
}
