import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, TrendingUp, AlertCircle, CheckCircle, Globe, Clock, Gauge,
  FileWarning, ArrowRight, BarChart3, MousePointerClick, Eye, Award,
  Sparkles, Copy, Link as LinkIcon, Loader2, Users, Activity, Hourglass,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface SeoSuggestion { priority: "alta" | "media" | "baixa"; text: string }
interface SeoAuditResult {
  score: number;
  suggestions: SeoSuggestion[];
  keywords: string[];
  summary: string;
  performanceScore: number | null;
  metrics: { fcp: number; lcp: number; cls: number; tbt: number; si: number } | null;
  htmlAnalysis: {
    title: string | null; metaDescription: string | null;
    hasH1: boolean; h1Text: string | null;
    missingAltCount: number; totalImages: number;
    hasCanonical: boolean; hasViewport: boolean; wordCount: number;
    hasOgTitle: boolean; hasOgDescription: boolean; hasOgImage: boolean;
    hasGoogleAnalytics: boolean; hasRobotsTxt: boolean; hasSitemap: boolean;
  };
  analyzedAt: string; url: string;
}

interface ScData {
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  daily: Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>;
  siteUrl?: string;
  needsSiteUrl?: boolean;
  sites?: Array<{ siteUrl: string; permissionLevel: string }>;
  connected?: boolean;
  error?: string;
}

interface MetaSuggestion {
  angle: string;
  title: string;
  description: string;
  keywords: string[];
}

export default function SEO() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState<string | null>(null);
  const [businessMeta, setBusinessMeta] = useState<{ name?: string; sector?: string; description?: string }>({});
  const [domainLoading, setDomainLoading] = useState(true);
  const [analysis, setAnalysis] = useState<SeoAuditResult | null>(null);

  // Search Console
  const [scLoading, setScLoading] = useState(false);
  const [scData, setScData] = useState<ScData | null>(null);
  const [scConnected, setScConnected] = useState<boolean | null>(null);
  const [hasGA4, setHasGA4] = useState<boolean | null>(null);
  const [creatingGA4, setCreatingGA4] = useState(false);

  // GA4 Traffic
  const [gaLoading, setGaLoading] = useState(false);
  const [gaData, setGaData] = useState<{
    hasProperty: boolean;
    hasData?: boolean;
    totals?: { sessions: number; users: number; pageviews: number; engagementRate: number };
    error?: string;
  } | null>(null);

  // Meta tag generator
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaSuggestions, setMetaSuggestions] = useState<MetaSuggestion[] | null>(null);

  useEffect(() => { fetchProjectDomain(); }, [user]);

  // Auto-fetch GA4 traffic when connected
  useEffect(() => {
    if (scConnected) {
      handleFetchGA4();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scConnected]);

  // Handle OAuth callback flags (auto-verify SC + GA4 detection)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_analytics_connected") === "true") {
      const autoVerified = params.get("sc_auto_verified") === "1";
      const ga4 = params.get("has_ga4") === "1";
      setHasGA4(ga4);
      toast({
        title: "Inteligência Google ativada ✅",
        description: autoVerified
          ? "Site adicionado automaticamente ao Search Console."
          : "Liga concluída. Pode ser necessário verificar o site manualmente.",
      });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("google_analytics_error")) {
      toast({
        variant: "destructive",
        title: "Erro Google",
        description: params.get("google_analytics_error") || "",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function fetchProjectDomain() {
    if (!user) return;
    setDomainLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("domain, website, business_name, business_sector, description")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fallback chain: domain → website
    const resolved = data?.domain || data?.website || null;
    setDomain(resolved);
    setBusinessMeta({
      name: data?.business_name || undefined,
      sector: data?.business_sector || undefined,
      description: data?.description || undefined,
    });
    setDomainLoading(false);

    // Check Search Console connection
    if (user) {
      const { data: conn } = await supabase
        .from("google_analytics_connections")
        .select("id, search_console_site_url")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      setScConnected(!!conn);
    }
  }

  const handleAnalyze = async () => {
    if (!domain) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-seo", { body: { url: domain } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data as SeoAuditResult);
      toast({ title: "Auditoria concluída ✅", description: `Score SEO: ${data.score}/100` });
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

  const handleConnectSearchConsole = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("google-analytics-auth", {
        body: { return_origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.auth_url) window.location.href = data.auth_url;
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erro ao conectar",
        description: e instanceof Error ? e.message : "Não foi possível iniciar a ligação.",
      });
    }
  };

  const handleFetchSearchConsole = async (siteUrl?: string) => {
    setScLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-search-console", {
        body: { siteUrl: siteUrl || domain },
      });
      if (error) throw error;
      setScData(data as ScData);
      if (data?.error) {
        toast({ variant: "destructive", title: "Search Console", description: data.error });
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erro Search Console",
        description: e instanceof Error ? e.message : "Falha ao obter dados.",
      });
    } finally {
      setScLoading(false);
    }
  };

  const handleCreateGA4 = async () => {
    setCreatingGA4(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-ga4-property", { body: {} });
      if (error) throw error;
      if (data?.needsAccount) {
        toast({
          title: "Cria a conta Google Analytics primeiro",
          description: data.message,
        });
        window.open(data.accountUrl, "_blank");
        return;
      }
      if (data?.error) throw new Error(data.error);
      setHasGA4(true);
      toast({
        title: "Google Analytics criado ✅",
        description: data?.measurementId
          ? `Measurement ID: ${data.measurementId}`
          : "Propriedade GA4 configurada.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erro a criar GA4",
        description: e instanceof Error ? e.message : "Falha desconhecida.",
      });
    } finally {
      setCreatingGA4(false);
    }
  };

  const handleFetchGA4 = async () => {
    setGaLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-ga4-traffic", { body: {} });
      if (error) throw error;
      setGaData(data);
    } catch (e) {
      console.error("GA4 traffic error:", e);
    } finally {
      setGaLoading(false);
    }
  };

  const handleGenerateMeta = async () => {
    if (!domain) return;
    setMetaLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-meta-tags", {
        body: {
          url: domain,
          businessName: businessMeta.name,
          businessSector: businessMeta.sector,
          description: businessMeta.description,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMetaSuggestions(data.suggestions || []);
      toast({ title: "Sugestões geradas ✅" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erro a gerar metadados",
        description: e instanceof Error ? e.message : "Falha desconhecida.",
      });
    } finally {
      setMetaLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado ✅` });
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
  const getPriorityLabel = (p: string) => p === "alta" ? "Alta" : p === "media" ? "Média" : "Baixa";
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
          Auditoria, Search Console, PageSpeed e geração de metadados por IA — tudo num só lugar
        </p>
      </div>

      {!domain ? (
        <Card className="glass border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <FileWarning className="h-8 w-8 text-yellow-500 shrink-0" />
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Domínio não configurado</h3>
                <p className="text-sm text-muted-foreground">
                  Preenche o campo <strong>Website</strong> em <strong>Configurações da Empresa</strong> para ativar o módulo SEO.
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate("/settings")} className="mt-2">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Ir para Configurações
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="audit" className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-2xl">
            <TabsTrigger value="audit"><Gauge className="h-4 w-4 mr-2" />Auditoria & PageSpeed</TabsTrigger>
            <TabsTrigger value="searchconsole"><BarChart3 className="h-4 w-4 mr-2" />Search Console</TabsTrigger>
            <TabsTrigger value="metatags"><Sparkles className="h-4 w-4 mr-2" />Metadados IA</TabsTrigger>
          </TabsList>

          {/* ============== TAB: AUDIT ============== */}
          <TabsContent value="audit" className="space-y-6 mt-6">
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
                          Última análise: {new Date(analysis.analyzedAt).toLocaleString("pt-PT")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button onClick={handleAnalyze} disabled={loading}>
                    {loading ? <span className="animate-pulse">A analisar...</span> : (
                      <><Search className="h-4 w-4 mr-2" />{analysis ? "Atualizar Auditoria" : "Iniciar Auditoria"}</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {analysis && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="glass">
                  <CardHeader><CardTitle>Score de Visibilidade</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className={`text-6xl font-bold ${getScoreColor(analysis.score)}`}>{analysis.score}</div>
                      <p className="text-muted-foreground mt-2">de 100 pontos</p>
                      <div className="mt-4 h-4 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-500 ${getScoreBg(analysis.score)}`} style={{ width: `${analysis.score}%` }} />
                      </div>
                      {analysis.summary && (
                        <p className="text-xs text-muted-foreground mt-4 text-left leading-relaxed">{analysis.summary}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Sugestões de Melhoria</CardTitle>
                    <CardDescription>Geradas com base nos dados reais do PageSpeed e HTML</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analysis.suggestions.map((s, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          {s.priority === "alta" ? <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" /> :
                           s.priority === "media" ? <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" /> :
                           <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0"><span className="text-sm">{s.text}</span></div>
                          <Badge variant="outline" className={`shrink-0 text-xs ${getPriorityColor(s.priority)}`}>{getPriorityLabel(s.priority)}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {analysis.metrics && (
                  <Card className="glass lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" />Métricas PageSpeed Insights</CardTitle>
                      <CardDescription>Dados reais Google PageSpeed (Mobile) {analysis.performanceScore !== null && `— Score: ${analysis.performanceScore}/100`}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                          { label: "FCP", value: analysis.metrics.fcp, unit: "s", good: 1800 },
                          { label: "LCP", value: analysis.metrics.lcp, unit: "s", good: 2500 },
                          { label: "CLS", value: analysis.metrics.cls, unit: "", good: 0.1 },
                          { label: "TBT", value: analysis.metrics.tbt, unit: "ms", good: 200 },
                          { label: "SI", value: analysis.metrics.si, unit: "s", good: 3400 },
                        ].map((m) => (
                          <div key={m.label} className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                            <p className={`text-lg font-bold ${m.value <= m.good ? "text-green-500" : "text-yellow-500"}`}>
                              {formatMetric(m.value, m.unit)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="glass">
                  <CardHeader><CardTitle className="text-base">Verificação Técnica</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {[
                        { label: "Título", ok: !!analysis.htmlAnalysis.title },
                        { label: "Meta Description", ok: !!analysis.htmlAnalysis.metaDescription },
                        { label: "Tag H1", ok: analysis.htmlAnalysis.hasH1 },
                        { label: "Canonical", ok: analysis.htmlAnalysis.hasCanonical },
                        { label: "Viewport", ok: analysis.htmlAnalysis.hasViewport },
                        { label: `Imagens sem alt (${analysis.htmlAnalysis.missingAltCount}/${analysis.htmlAnalysis.totalImages})`, ok: analysis.htmlAnalysis.missingAltCount === 0 },
                        { label: "OG Title", ok: analysis.htmlAnalysis.hasOgTitle },
                        { label: "OG Description", ok: analysis.htmlAnalysis.hasOgDescription },
                        { label: "OG Image", ok: analysis.htmlAnalysis.hasOgImage },
                        { label: "Google Analytics", ok: analysis.htmlAnalysis.hasGoogleAnalytics },
                        { label: "robots.txt", ok: analysis.htmlAnalysis.hasRobotsTxt },
                        { label: "sitemap.xml", ok: analysis.htmlAnalysis.hasSitemap },
                      ].map((c) => (
                        <div key={c.label} className="flex items-center justify-between py-1">
                          <span className="text-muted-foreground">{c.label}</span>
                          {c.ok ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-400" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass lg:col-span-3">
                  <CardHeader><CardTitle>Keywords Detetadas</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysis.keywords.map((k, i) => (
                        <Badge key={i} variant="secondary" className="text-sm py-1 px-3">{k}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ============== TAB: SEARCH CONSOLE ============== */}
          <TabsContent value="searchconsole" className="space-y-6 mt-6">
            {scConnected === false ? (
              <Card className="glass border-blue-500/30 bg-blue-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <BarChart3 className="h-8 w-8 text-blue-500 shrink-0" />
                    <div className="space-y-3 flex-1">
                      <div>
                        <h3 className="font-semibold text-foreground">Ativa a Inteligência Google para o teu Site</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          O Nexus liga-se à tua conta Google e tenta verificar automaticamente o teu site no Search Console. Depois puxamos dados reais de Cliques, Impressões, CTR e Posição Média.
                        </p>
                      </div>
                      <Button onClick={handleConnectSearchConsole}>
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Ativar Inteligência Google para o meu Site
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="glass">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium text-foreground">Search Console conectado</p>
                          <p className="text-xs text-muted-foreground">Últimos 28 dias</p>
                        </div>
                      </div>
                      <Button onClick={() => handleFetchSearchConsole()} disabled={scLoading}>
                        {scLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                        {scData ? "Atualizar" : "Carregar dados"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {hasGA4 === false && (
                  <Card className="glass border-primary/30 bg-primary/5">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <Sparkles className="h-8 w-8 text-primary shrink-0" />
                        <div className="space-y-3 flex-1">
                          <div>
                            <h3 className="font-semibold text-foreground">Ainda não tens Google Analytics</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              O Nexus pode criar e configurar uma propriedade GA4 para o teu site automaticamente — sem teres de mexer em painéis técnicos.
                            </p>
                          </div>
                          <Button onClick={handleCreateGA4} disabled={creatingGA4}>
                            {creatingGA4 ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            IA: Criar e Configurar Google Analytics para mim
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {scData?.needsSiteUrl && scData.sites && (
                  <Card className="glass">
                    <CardHeader>
                      <CardTitle className="text-base">Escolhe a propriedade</CardTitle>
                      <CardDescription>Seleciona o site associado ao teu domínio</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {scData.sites.map((s) => (
                        <Button key={s.siteUrl} variant="outline" className="w-full justify-between"
                          onClick={() => handleFetchSearchConsole(s.siteUrl)}>
                          <span className="truncate">{s.siteUrl}</span>
                          <Badge variant="secondary">{s.permissionLevel}</Badge>
                        </Button>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {scData?.totals && !scData.needsSiteUrl && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="glass">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <MousePointerClick className="h-8 w-8 text-primary" />
                          <div>
                            <p className="text-xs text-muted-foreground">Cliques</p>
                            <p className="text-2xl font-bold">{scData.totals.clicks.toLocaleString("pt-PT")}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="glass">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <Eye className="h-8 w-8 text-blue-400" />
                          <div>
                            <p className="text-xs text-muted-foreground">Impressões</p>
                            <p className="text-2xl font-bold">{scData.totals.impressions.toLocaleString("pt-PT")}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="glass">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <TrendingUp className="h-8 w-8 text-green-400" />
                          <div>
                            <p className="text-xs text-muted-foreground">CTR Médio</p>
                            <p className="text-2xl font-bold">{(scData.totals.ctr * 100).toFixed(2)}%</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="glass">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <Award className="h-8 w-8 text-yellow-400" />
                          <div>
                            <p className="text-xs text-muted-foreground">Posição Média</p>
                            <p className="text-2xl font-bold">{scData.totals.position.toFixed(1)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Empty state — no SC data yet */}
                {scData && !scData.needsSiteUrl && scData.totals && scData.totals.impressions === 0 && (
                  <Card className="glass border-blue-500/20 bg-blue-500/5">
                    <CardContent className="pt-6 text-center">
                      <Hourglass className="h-10 w-10 text-blue-400 mx-auto mb-3" />
                      <h3 className="font-semibold text-foreground mb-1">O Google está a começar a ler o seu site</h3>
                      <p className="text-sm text-muted-foreground">
                        Volte em 24h para ver as primeiras métricas de Search Console!
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* GA4 Traffic Section */}
                {gaData?.hasProperty && gaData.totals && gaData.hasData && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mt-2">
                      <Activity className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Tráfego do Site (Google Analytics)</h3>
                      <Badge variant="secondary" className="text-xs">Últimos 28 dias</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card className="glass">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <Users className="h-8 w-8 text-purple-400" />
                            <div>
                              <p className="text-xs text-muted-foreground">Utilizadores</p>
                              <p className="text-2xl font-bold">{gaData.totals.users.toLocaleString("pt-PT")}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="glass">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <Activity className="h-8 w-8 text-cyan-400" />
                            <div>
                              <p className="text-xs text-muted-foreground">Sessões</p>
                              <p className="text-2xl font-bold">{gaData.totals.sessions.toLocaleString("pt-PT")}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="glass">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <Eye className="h-8 w-8 text-blue-400" />
                            <div>
                              <p className="text-xs text-muted-foreground">Páginas Vistas</p>
                              <p className="text-2xl font-bold">{gaData.totals.pageviews.toLocaleString("pt-PT")}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="glass">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <TrendingUp className="h-8 w-8 text-green-400" />
                            <div>
                              <p className="text-xs text-muted-foreground">Taxa Engagement</p>
                              <p className="text-2xl font-bold">{(gaData.totals.engagementRate * 100).toFixed(1)}%</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* GA4 connected but no data yet */}
                {gaData?.hasProperty && !gaData.hasData && !gaData.error && (
                  <Card className="glass border-purple-500/20 bg-purple-500/5">
                    <CardContent className="pt-6 text-center">
                      <Hourglass className="h-10 w-10 text-purple-400 mx-auto mb-3" />
                      <h3 className="font-semibold text-foreground mb-1">O Google Analytics ainda está a recolher dados</h3>
                      <p className="text-sm text-muted-foreground">
                        Volte em 24h para ver as primeiras métricas de tráfego do seu site!
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ============== TAB: META TAGS GENERATOR ============== */}
          <TabsContent value="metatags" className="space-y-6 mt-6">
            <Card className="glass border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Gerador de Metadados (IA)
                </CardTitle>
                <CardDescription>
                  A IA analisa o conteúdo real do teu site e o DNA do teu negócio para sugerir 3 conjuntos de Title + Description otimizados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleGenerateMeta} disabled={metaLoading} size="lg">
                  {metaLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {metaLoading ? "A gerar..." : metaSuggestions ? "Gerar novamente" : "Gerar Sugestões"}
                </Button>
              </CardContent>
            </Card>

            {metaSuggestions && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {metaSuggestions.map((s, i) => (
                  <Card key={i} className="glass">
                    <CardHeader>
                      <Badge variant="outline" className="w-fit mb-2">{s.angle}</Badge>
                      <CardTitle className="text-base">Sugestão #{i + 1}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-muted-foreground">Title ({s.title.length}/60)</p>
                          <Button size="sm" variant="ghost" className="h-6 px-2"
                            onClick={() => copyToClipboard(s.title, "Title")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm font-medium bg-muted/50 p-2 rounded">{s.title}</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-muted-foreground">Description ({s.description.length}/155)</p>
                          <Button size="sm" variant="ghost" className="h-6 px-2"
                            onClick={() => copyToClipboard(s.description, "Description")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm bg-muted/50 p-2 rounded">{s.description}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Keywords</p>
                        <div className="flex flex-wrap gap-1">
                          {s.keywords.map((k, ki) => (
                            <Badge key={ki} variant="secondary" className="text-xs">{k}</Badge>
                          ))}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full"
                        onClick={() => copyToClipboard(
                          `<title>${s.title}</title>\n<meta name="description" content="${s.description}">\n<meta name="keywords" content="${s.keywords.join(", ")}">`,
                          "HTML completo"
                        )}>
                        <Copy className="h-4 w-4 mr-2" />Copiar HTML
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
