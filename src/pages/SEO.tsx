import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, TrendingUp, AlertCircle, CheckCircle, Globe, Clock, Gauge, FileWarning, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface SeoSuggestion {
  priority: "alta" | "media" | "baixa";
  text: string;
}

interface SeoAuditResult {
  score: number;
  suggestions: SeoSuggestion[];
  keywords: string[];
  summary: string;
  performanceScore: number | null;
  metrics: {
    fcp: number;
    lcp: number;
    cls: number;
    tbt: number;
    si: number;
  } | null;
  htmlAnalysis: {
    title: string | null;
    metaDescription: string | null;
    hasH1: boolean;
    h1Text: string | null;
    missingAltCount: number;
    totalImages: number;
    hasCanonical: boolean;
    hasViewport: boolean;
    wordCount: number;
    hasOgTitle: boolean;
    hasOgDescription: boolean;
    hasOgImage: boolean;
    hasGoogleAnalytics: boolean;
    hasRobotsTxt: boolean;
    hasSitemap: boolean;
  };
  analyzedAt: string;
  url: string;
}

export default function SEO() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState<string | null>(null);
  const [domainLoading, setDomainLoading] = useState(true);
  const [analysis, setAnalysis] = useState<SeoAuditResult | null>(null);

  useEffect(() => {
    fetchProjectDomain();
  }, [user]);

  async function fetchProjectDomain() {
    if (!user) return;
    setDomainLoading(true);

    const { data, error } = await supabase
      .from("projects")
      .select("domain")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.domain) {
      setDomain(data.domain);
    } else {
      setDomain(null);
    }
    setDomainLoading(false);
  }

  const handleAnalyze = async () => {
    if (!domain) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-seo", {
        body: { url: domain },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data as SeoAuditResult);
      toast({
        title: "Auditoria concluída ✅",
        description: `Score SEO: ${data.score}/100`,
      });
    } catch (error) {
      console.error("SEO analysis error:", error);
      toast({
        variant: "destructive",
        title: "Erro na auditoria",
        description: error instanceof Error ? error.message : "Não foi possível analisar o site.",
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getPriorityColor = (priority: string) => {
    if (priority === "alta") return "text-red-400 bg-red-500/10 border-red-500/20";
    if (priority === "media") return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    return "text-green-400 bg-green-500/10 border-green-500/20";
  };

  const getPriorityLabel = (priority: string) => {
    if (priority === "alta") return "Alta";
    if (priority === "media") return "Média";
    return "Baixa";
  };

  const formatMetric = (value: number, unit: string) => {
    if (unit === "s") return `${(value / 1000).toFixed(1)}s`;
    if (unit === "ms") return `${value.toFixed(0)}ms`;
    return value.toFixed(3);
  };

  if (domainLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Search className="h-8 w-8 text-primary" />
          Visibilidade no Google
        </h1>
        <p className="text-muted-foreground mt-1">
          Auditoria real do teu site com dados do Google PageSpeed e análise inteligente
        </p>
      </div>

      {/* Domain Status */}
      {!domain ? (
        <Card className="glass border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <FileWarning className="h-8 w-8 text-yellow-500 shrink-0" />
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Domínio não configurado</h3>
                <p className="text-sm text-muted-foreground">
                  Configura o teu domínio na <strong>Identidade da Marca</strong> para ativar a Auditoria SEO automática.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/settings")}
                  className="mt-2"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Configurar Domínio
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Domain Info & Action */}
          <Card className="glass">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{domain}</p>
                    {analysis?.analyzedAt && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        Última análise: {new Date(analysis.analyzedAt).toLocaleString("pt-PT", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <Button onClick={handleAnalyze} disabled={loading}>
                  {loading ? (
                    <span className="animate-pulse">A analisar...</span>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      {analysis ? "Atualizar Auditoria" : "Iniciar Auditoria"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {analysis && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Score Card */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Score de Visibilidade</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className={`text-6xl font-bold ${getScoreColor(analysis.score)}`}>
                      {analysis.score}
                    </div>
                    <p className="text-muted-foreground mt-2">de 100 pontos</p>
                    <div className="mt-4 h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${getScoreBg(analysis.score)}`}
                        style={{ width: `${analysis.score}%` }}
                      />
                    </div>
                    {analysis.summary && (
                      <p className="text-xs text-muted-foreground mt-4 text-left leading-relaxed">
                        {analysis.summary}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Suggestions */}
              <Card className="glass lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Sugestões de Melhoria
                  </CardTitle>
                  <CardDescription>Geradas com base nos dados reais do teu site</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.suggestions.map((suggestion, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                      >
                        {suggestion.priority === "alta" ? (
                          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                        ) : suggestion.priority === "media" ? (
                          <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm">{suggestion.text}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-xs ${getPriorityColor(suggestion.priority)}`}
                        >
                          {getPriorityLabel(suggestion.priority)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              {analysis.metrics && (
                <Card className="glass lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gauge className="h-5 w-5 text-primary" />
                      Métricas de Performance
                    </CardTitle>
                    <CardDescription>Dados reais do Google PageSpeed Insights (Mobile)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {[
                        { label: "FCP", value: analysis.metrics.fcp, unit: "s", good: 1800 },
                        { label: "LCP", value: analysis.metrics.lcp, unit: "s", good: 2500 },
                        { label: "CLS", value: analysis.metrics.cls, unit: "", good: 0.1 },
                        { label: "TBT", value: analysis.metrics.tbt, unit: "ms", good: 200 },
                        { label: "SI", value: analysis.metrics.si, unit: "s", good: 3400 },
                      ].map((metric) => (
                        <div key={metric.label} className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
                          <p
                            className={`text-lg font-bold ${
                              metric.value <= metric.good ? "text-green-500" : "text-yellow-500"
                            }`}
                          >
                            {formatMetric(metric.value, metric.unit)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* HTML & SEO Check */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-base">Verificação Técnica</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: "Título", ok: !!analysis.htmlAnalysis.title },
                      { label: "Meta Description", ok: !!analysis.htmlAnalysis.metaDescription },
                      { label: "Tag H1", ok: analysis.htmlAnalysis.hasH1 },
                      { label: "Canonical", ok: analysis.htmlAnalysis.hasCanonical },
                      { label: "Viewport", ok: analysis.htmlAnalysis.hasViewport },
                      {
                        label: `Imagens sem alt (${analysis.htmlAnalysis.missingAltCount}/${analysis.htmlAnalysis.totalImages})`,
                        ok: analysis.htmlAnalysis.missingAltCount === 0,
                      },
                      { label: "OG Title", ok: analysis.htmlAnalysis.hasOgTitle },
                      { label: "OG Description", ok: analysis.htmlAnalysis.hasOgDescription },
                      { label: "OG Image", ok: analysis.htmlAnalysis.hasOgImage },
                      { label: "Google Analytics", ok: analysis.htmlAnalysis.hasGoogleAnalytics },
                      { label: "robots.txt", ok: analysis.htmlAnalysis.hasRobotsTxt },
                      { label: "sitemap.xml", ok: analysis.htmlAnalysis.hasSitemap },
                    ].map((check) => (
                      <div key={check.label} className="flex items-center justify-between py-1">
                        <span className="text-muted-foreground">{check.label}</span>
                        {check.ok ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Green Light Status */}
                  {analysis.htmlAnalysis.title &&
                    analysis.htmlAnalysis.metaDescription &&
                    analysis.htmlAnalysis.hasH1 &&
                    analysis.htmlAnalysis.hasOgTitle &&
                    analysis.htmlAnalysis.hasOgDescription &&
                    analysis.htmlAnalysis.hasRobotsTxt &&
                    analysis.htmlAnalysis.hasSitemap && (
                    <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-medium text-green-400">
                        🟢 Site pronto para o Google!
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Keywords */}
              <Card className="glass lg:col-span-3">
                <CardHeader>
                  <CardTitle>Keywords Detetadas</CardTitle>
                  <CardDescription>
                    Palavras-chave reais extraídas do conteúdo do teu site
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {analysis.keywords.map((keyword, i) => (
                      <Badge key={i} variant="secondary" className="text-sm py-1 px-3">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
