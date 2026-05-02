import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  LayoutTemplate,
  Palette,
  FileText,
  Search,
  Rocket,
  ChevronRight,
  ShieldCheck,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

export type ConciergeStep = "template" | "brand" | "content" | "seo" | "publish";

const STEPS: { key: ConciergeStep; label: string; icon: any; advice: string }[] = [
  {
    key: "template",
    label: "Escolher Modelo",
    icon: LayoutTemplate,
    advice:
      "Começa por um modelo profissional do teu setor. Eu pré-preencho títulos, secções e imagens para acelerares.",
  },
  {
    key: "brand",
    label: "Marca Herdada",
    icon: Palette,
    advice:
      "Leio silenciosamente o Perfil da Empresa e aplico logótipo, paleta e tipografia sem pedir configurações repetidas.",
  },
  {
    key: "content",
    label: "Conteúdo & Imagens",
    icon: FileText,
    advice:
      "Edita textos das secções e adiciona imagens. Para fotos, podes carregar do teu computador ou pedir-me para gerar com IA otimizada para o teu setor.",
  },
  {
    key: "seo",
    label: "SEO & Google Stack",
    icon: Search,
    advice:
      "Confirmo as Meta Tags automáticas e a ligação ao Google Analytics/Ads (MCC 8664492509) para o teu site nascer pronto a vender.",
  },
  {
    key: "publish",
    label: "Pré-visualizar & Publicar",
    icon: Rocket,
    advice:
      "Gero um link temporário para partilhares com a tua equipa. Quando aprovares, publico em nexus.web-business.pt.",
  },
];

interface ChecklistItem {
  done: boolean;
  label: string;
  hint?: string;
  cta?: { label: string; to?: string; onClick?: () => void };
}

interface Props {
  projectId: string | null;
  hasSections: boolean;
  hasCustomBrand: boolean;
  isPublished: boolean;
  onJumpToTemplates: () => void;
  onJumpToBrand?: () => void;
  onJumpToPublish: () => void;
}

export function ConciergeWizard({
  projectId,
  hasSections,
  hasCustomBrand,
  isPublished,
  onJumpToTemplates,
  onJumpToBrand,
  onJumpToPublish,
}: Props) {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState<ConciergeStep>("template");
  const [checks, setChecks] = useState({
    template: false,
    brand: false,
    content: false,
    legal: false,
    metaTags: false,
    googleStack: false,
    domain: false,
  });
  const [loading, setLoading] = useState(true);

  // Detecta estado real do projeto
  useEffect(() => {
    if (!user || !projectId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const [proj, legal, ga] = await Promise.all([
        supabase
          .from("projects")
          .select("domain, google_analytics_id, gtm_container_id, measurement_id")
          .eq("id", projectId)
          .maybeSingle(),
        supabase
          .from("compliance_pages")
          .select("page_type")
          .eq("user_id", user.id)
          .in("page_type", ["privacy_policy", "terms_conditions", "cookie_policy"]),
        supabase
          .from("google_analytics_connections")
          .select("id, is_active")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle(),
      ]);

      const p = (proj.data as any) || {};
      const legalCount = legal.data?.length || 0;

      setChecks({
        template: hasSections,
        brand: hasCustomBrand,
        content: hasSections,
        legal: legalCount >= 3,
        metaTags: hasSections, // gerado no publish
        googleStack: !!(p.google_analytics_id || p.measurement_id || ga.data?.id),
        domain: !!p.domain || isPublished,
      });
      setLoading(false);
    })();
  }, [user, projectId, hasSections, hasCustomBrand, isPublished]);

  const checklist: Record<ConciergeStep, ChecklistItem[]> = useMemo(
    () => ({
      template: [
        {
          done: checks.template,
          label: "Modelo aplicado à página",
          hint: "Escolhe um modelo visual do teu setor para arrancar.",
          cta: { label: "Abrir galeria", onClick: onJumpToTemplates },
        },
      ],
      brand: [
        {
          done: checks.brand,
          label: "Marca carregada do Perfil da Empresa",
          hint: "Cores, fonte e logótipo são aplicados automaticamente. Não é uma etapa manual.",
        },
      ],
      content: [
        {
          done: checks.content,
          label: "Secções com conteúdo",
          hint: "Edita textos e adiciona imagens (upload ou geradas por IA).",
        },
        {
          done: checks.legal,
          label: "Páginas legais (Privacidade, Cookies, Termos)",
          hint: "Geradas com os dados do teu Perfil de Empresa. Não precisas repetir nada.",
          cta: { label: "Ver páginas legais", to: "/settings?tab=legal" },
        },
      ],
      seo: [
        {
          done: checks.metaTags,
          label: "Meta Tags automáticas no momento da publicação",
          hint: "Crio título e descrição SEO baseados no teu conteúdo.",
        },
        {
          done: checks.googleStack,
          label: "Google Analytics / Ads ligados (MCC 8664492509)",
          hint: "Liga o Google Stack para medires visitas e correres campanhas.",
          cta: { label: "Ligar Google", to: "/settings?tab=integrations" },
        },
      ],
      publish: [
        {
          done: checks.domain,
          label: "Domínio nexus.web-business.pt configurado",
          hint: "Publicação direta no subdomínio Nexus. Sem DNS para configurar.",
        },
        {
          done: isPublished,
          label: "Página publicada",
          cta: { label: "Publicar agora", onClick: onJumpToPublish },
        },
      ],
    }),
    [checks, isPublished, onJumpToTemplates, onJumpToBrand, onJumpToPublish]
  );

  const allChecks = Object.values(checks);
  const completedCount = allChecks.filter(Boolean).length;
  const progress = Math.round((completedCount / allChecks.length) * 100);

  const activeStepData = STEPS.find((s) => s.key === activeStep)!;
  const ActiveIcon = activeStepData.icon;
  const activeChecks = checklist[activeStep];
  const stepDone = activeChecks.every((c) => c.done);

  return (
    <Card className="glass border-primary/30 bg-gradient-to-br from-primary/10 via-background to-purple-500/5 overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-5 border-b border-border/50 bg-background/40">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold flex items-center gap-2">
                  Concierge Nexus
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                    Site Builder
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  Vou guiar-te até teres um site pronto a vender em{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-primary text-[10px]">
                    nexus.web-business.pt
                  </code>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Progresso global</p>
              <p className="text-lg font-bold text-primary">{progress}%</p>
            </div>
          </div>
          <Progress value={progress} className="h-1.5 mt-3" />
        </div>

        {/* Step navigation */}
        <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto bg-background/20 border-b border-border/40">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const stepChecks = checklist[step.key];
            const done = stepChecks.every((c) => c.done);
            const isActive = step.key === activeStep;
            return (
              <button
                key={step.key}
                onClick={() => setActiveStep(step.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : done
                    ? "text-emerald-500 hover:bg-muted"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span>
                  {i + 1}. {step.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active step content */}
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <ActiveIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm flex items-center gap-2">
                {activeStepData.label}
                {stepDone && (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Completo
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1 italic">
                "{activeStepData.advice}"
              </p>
            </div>
          </div>

          {/* Checklist for this step */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              activeChecks.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    item.done
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border/60 bg-background/40"
                  }`}
                >
                  {item.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        item.done ? "text-emerald-500" : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </p>
                    {item.hint && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.hint}</p>
                    )}
                  </div>
                  {!item.done && item.cta && (
                    <>
                      {item.cta.to ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={item.cta.to}>
                            {item.cta.label}
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={item.cta.onClick}>
                          {item.cta.label}
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Step navigation footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              disabled={STEPS.findIndex((s) => s.key === activeStep) === 0}
              onClick={() => {
                const idx = STEPS.findIndex((s) => s.key === activeStep);
                if (idx > 0) setActiveStep(STEPS[idx - 1].key);
              }}
            >
              ← Anterior
            </Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Tudo isolado por utilizador (RLS ativo)
            </div>
            <Button
              variant="default"
              size="sm"
              disabled={STEPS.findIndex((s) => s.key === activeStep) === STEPS.length - 1}
              onClick={() => {
                const idx = STEPS.findIndex((s) => s.key === activeStep);
                if (idx < STEPS.length - 1) setActiveStep(STEPS[idx + 1].key);
              }}
              className="bg-gradient-to-r from-primary to-purple-600"
            >
              Próximo passo →
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
