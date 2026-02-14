import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, BarChart3, TrendingUp, Users, MousePointerClick,
  Eye, Loader2, ExternalLink, CheckCircle2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

interface SearchConsoleData {
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  daily: { date: string; clicks: number; impressions: number; ctr: number; position: number }[];
  siteUrl?: string;
  needsSiteUrl?: boolean;
  sites?: { siteUrl: string; permissionLevel: string }[];
}

interface GA4Data {
  totals: { sessions: number; activeUsers: number; pageViews: number; bounceRate: number };
  daily: { date: string; sessions: number; activeUsers: number; pageViews: number; bounceRate: number }[];
  propertyId?: string;
  needsPropertyId?: boolean;
  properties?: { propertyId: string; displayName: string }[];
}

export function PerformanceTab() {
  const { user } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [googleEmail, setGoogleEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Search Console
  const [scData, setScData] = useState<SearchConsoleData | null>(null);
  const [scLoading, setScLoading] = useState(false);
  const [scSites, setScSites] = useState<{ siteUrl: string; permissionLevel: string }[]>([]);
  const [selectedSite, setSelectedSite] = useState("");

  // GA4
  const [ga4Data, setGa4Data] = useState<GA4Data | null>(null);
  const [ga4Loading, setGa4Loading] = useState(false);
  const [ga4Properties, setGa4Properties] = useState<{ propertyId: string; displayName: string }[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");

  useEffect(() => {
    checkConnection();
  }, [user]);

  async function checkConnection() {
    if (!user) return;
    const { data } = await supabase
      .from("google_analytics_connections")
      .select("google_email, search_console_site_url, ga4_property_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (data) {
      setConnected(true);
      setGoogleEmail(data.google_email || "");
      if (data.search_console_site_url) setSelectedSite(data.search_console_site_url);
      if (data.ga4_property_id) setSelectedProperty(data.ga4_property_id);
      // Auto-fetch data
      fetchSearchConsole(data.search_console_site_url || undefined);
      fetchGA4(data.ga4_property_id || undefined);
    } else {
      setConnected(false);
    }
    setLoading(false);
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-analytics-auth", {
        body: null,
        headers: {},
      });

      // Need to pass return_origin as query param
      const origin = window.location.origin;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-analytics-auth?return_origin=${encodeURIComponent(origin)}`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );
      const result = await res.json();

      if (result.auth_url) {
        window.location.href = result.auth_url;
      } else {
        toast.error("Erro ao iniciar autenticação Google");
      }
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "Tenta novamente"));
    } finally {
      setConnecting(false);
    }
  }

  async function fetchSearchConsole(siteUrl?: string) {
    setScLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-search-console", {
        body: { siteUrl: siteUrl || selectedSite || undefined },
      });
      if (error) throw error;

      if (data.needsSiteUrl) {
        setScSites(data.sites || []);
        if (data.sites?.length === 1) {
          setSelectedSite(data.sites[0].siteUrl);
          // Save and re-fetch
          await saveSiteUrl(data.sites[0].siteUrl);
          fetchSearchConsole(data.sites[0].siteUrl);
          return;
        }
      } else if (data.error) {
        toast.error("Search Console: " + data.error);
      } else {
        setScData(data);
      }
    } catch (e: any) {
      console.error("SC error:", e);
    } finally {
      setScLoading(false);
    }
  }

  async function fetchGA4(propertyId?: string) {
    setGa4Loading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-ga4-data", {
        body: { propertyId: propertyId || selectedProperty || undefined },
      });
      if (error) throw error;

      if (data.needsPropertyId) {
        setGa4Properties(data.properties || []);
        if (data.properties?.length === 1) {
          setSelectedProperty(data.properties[0].propertyId);
          await savePropertyId(data.properties[0].propertyId);
          fetchGA4(data.properties[0].propertyId);
          return;
        }
      } else if (data.error) {
        toast.error("GA4: " + data.error);
      } else {
        setGa4Data(data);
      }
    } catch (e: any) {
      console.error("GA4 error:", e);
    } finally {
      setGa4Loading(false);
    }
  }

  async function saveSiteUrl(siteUrl: string) {
    if (!user) return;
    await supabase
      .from("google_analytics_connections")
      .update({ search_console_site_url: siteUrl })
      .eq("user_id", user.id)
      .eq("is_active", true);
  }

  async function savePropertyId(propertyId: string) {
    if (!user) return;
    await supabase
      .from("google_analytics_connections")
      .update({ ga4_property_id: propertyId })
      .eq("user_id", user.id)
      .eq("is_active", true);
  }

  async function handleSelectSite(siteUrl: string) {
    setSelectedSite(siteUrl);
    await saveSiteUrl(siteUrl);
    fetchSearchConsole(siteUrl);
  }

  async function handleSelectProperty(propertyId: string) {
    setSelectedProperty(propertyId);
    await savePropertyId(propertyId);
    fetchGA4(propertyId);
  }

  // Handle OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_analytics_connected") === "true") {
      toast.success("Google Analytics & Search Console conectados!");
      window.history.replaceState({}, "", window.location.pathname);
      checkConnection();
    } else if (params.get("google_analytics_error")) {
      toast.error("Erro: " + params.get("google_analytics_error"));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!connected) {
    return (
      <Card className="glass border-primary/20">
        <CardContent className="p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-display font-semibold text-foreground">
            Conecta o Google para ver o Desempenho
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Liga a tua conta Google para ver cliques, impressões, sessões e utilizadores do teu site em tempo real.
          </p>
          <Button onClick={handleConnect} disabled={connecting} className="gap-2">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Conectar Google Analytics & Search Console
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30 gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Google conectado
          </Badge>
          <span className="text-sm text-muted-foreground">{googleEmail}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { fetchSearchConsole(); fetchGA4(); }}>
          Atualizar dados
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search Console Widget */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Search Console
            </CardTitle>
            <CardDescription>Cliques e impressões orgânicas (últimos 28 dias)</CardDescription>
          </CardHeader>
          <CardContent>
            {scSites.length > 0 && !scData && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Seleciona o teu site:</p>
                <Select onValueChange={handleSelectSite}>
                  <SelectTrigger><SelectValue placeholder="Escolher site..." /></SelectTrigger>
                  <SelectContent>
                    {scSites.map((s) => (
                      <SelectItem key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : scData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <MousePointerClick className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Cliques</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {scData.totals.clicks.toLocaleString("pt-PT")}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="h-4 w-4 text-neon-blue" />
                      <span className="text-xs text-muted-foreground">Impressões</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {scData.totals.impressions.toLocaleString("pt-PT")}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-neon-green" />
                      <span className="text-xs text-muted-foreground">CTR Médio</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {(scData.totals.ctr * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Posição Média</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {scData.totals.position.toFixed(1)}
                    </p>
                  </div>
                </div>

                {/* Mini sparkline-style daily data */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Últimos 7 dias</p>
                  <div className="flex gap-1 items-end h-12">
                    {scData.daily.slice(-7).map((d, i) => {
                      const maxClicks = Math.max(...scData.daily.slice(-7).map((r) => r.clicks), 1);
                      const height = (d.clicks / maxClicks) * 100;
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-primary/60 rounded-t hover:bg-primary transition-colors"
                          style={{ height: `${Math.max(height, 4)}%` }}
                          title={`${d.date}: ${d.clicks} cliques`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sem dados disponíveis. Verifica se o site está verificado no Search Console.
              </p>
            )}
          </CardContent>
        </Card>

        {/* GA4 Widget */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Google Analytics (GA4)
            </CardTitle>
            <CardDescription>Sessões e utilizadores ativos (últimos 28 dias)</CardDescription>
          </CardHeader>
          <CardContent>
            {ga4Properties.length > 0 && !ga4Data && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Seleciona a propriedade GA4:</p>
                <Select onValueChange={handleSelectProperty}>
                  <SelectTrigger><SelectValue placeholder="Escolher propriedade..." /></SelectTrigger>
                  <SelectContent>
                    {ga4Properties.map((p) => (
                      <SelectItem key={p.propertyId} value={p.propertyId}>{p.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {ga4Loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : ga4Data ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Sessões</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {ga4Data.totals.sessions.toLocaleString("pt-PT")}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4 text-neon-green" />
                      <span className="text-xs text-muted-foreground">Utilizadores Ativos</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {ga4Data.totals.activeUsers.toLocaleString("pt-PT")}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="h-4 w-4 text-neon-blue" />
                      <span className="text-xs text-muted-foreground">Visualizações</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {ga4Data.totals.pageViews.toLocaleString("pt-PT")}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowDownRight className="h-4 w-4 text-destructive" />
                      <span className="text-xs text-muted-foreground">Bounce Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {(ga4Data.totals.bounceRate * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Mini sparkline */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Sessões - Últimos 7 dias</p>
                  <div className="flex gap-1 items-end h-12">
                    {ga4Data.daily.slice(-7).map((d, i) => {
                      const maxSessions = Math.max(...ga4Data.daily.slice(-7).map((r) => r.sessions), 1);
                      const height = (d.sessions / maxSessions) * 100;
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-neon-green/60 rounded-t hover:bg-neon-green transition-colors"
                          style={{ height: `${Math.max(height, 4)}%` }}
                          title={`${d.date}: ${d.sessions} sessões`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sem dados disponíveis. Verifica se tens uma propriedade GA4 configurada.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
