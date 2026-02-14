import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  Sparkles, Users, Share2, MessageCircle, Flame, TrendingUp, 
  ArrowRight, Zap, Globe, Instagram, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface Insight {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  route: string;
  priority: "high" | "medium" | "low";
}

export function RegularDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    projects: 0, leads: 0, hotLeads: 0, posts: 0,
    publishedPosts: 0, unansweredHotLeads: 0, draftPosts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [metaConnected, setMetaConnected] = useState(false);
  const [whatsappActive, setWhatsappActive] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      if (!user) return;
      try {
        const [projectsRes, leadsRes, hotLeadsRes, postsRes, publishedRes, draftsRes, profileRes, metaRes, waRes] = await Promise.all([
          supabase.from("projects").select("id", { count: "exact", head: true }),
          supabase.from("leads").select("id", { count: "exact", head: true }),
          supabase.from("leads").select("id", { count: "exact", head: true }).eq("ai_classification", "hot"),
          supabase.from("social_posts").select("id", { count: "exact", head: true }),
          supabase.from("social_posts").select("id", { count: "exact", head: true }).eq("status", "published"),
          supabase.from("social_posts").select("id", { count: "exact", head: true }).eq("status", "draft"),
          supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
          supabase.from("projects").select("meta_access_token, meta_ads_account_id").eq("user_id", user.id).limit(1).maybeSingle(),
          supabase.from("whatsapp_accounts").select("id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle(),
        ]);
        setStats({
          projects: projectsRes.count ?? 0, leads: leadsRes.count ?? 0,
          hotLeads: hotLeadsRes.count ?? 0, posts: postsRes.count ?? 0,
          publishedPosts: publishedRes.count ?? 0,
          unansweredHotLeads: hotLeadsRes.count ?? 0,
          draftPosts: draftsRes.count ?? 0,
        });
        if (profileRes.data?.full_name) setProfileName(profileRes.data.full_name.split(" ")[0]);
        setMetaConnected(!!(metaRes.data?.meta_access_token && metaRes.data?.meta_ads_account_id));
        setWhatsappActive(!!waRes.data);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [user]);

  const insights: Insight[] = [];

  if (stats.hotLeads > 0) {
    insights.push({
      id: "hot-leads", icon: <Flame className="h-5 w-5 text-neon-green" />,
      title: `${stats.hotLeads} cliente${stats.hotLeads > 1 ? "s" : ""} quente${stats.hotLeads > 1 ? "s" : ""} à espera de resposta`,
      description: "Estes potenciais clientes mostraram forte interesse. Cada hora sem resposta reduz a chance de conversão em 30%.",
      action: "Responder agora", route: "/whatsapp", priority: "high",
    });
  }

  if (stats.draftPosts > 0) {
    insights.push({
      id: "draft-posts", icon: <Instagram className="h-5 w-5 text-neon-purple" />,
      title: `${stats.draftPosts} post${stats.draftPosts > 1 ? "s" : ""} pronto${stats.draftPosts > 1 ? "s" : ""} para publicar`,
      description: "Tens conteúdo criado mas não publicado. A consistência nas redes sociais é chave para o crescimento.",
      action: "Publicar posts", route: "/social-media", priority: "medium",
    });
  }

  if (stats.projects === 0) {
    insights.push({
      id: "no-site", icon: <Globe className="h-5 w-5 text-primary" />,
      title: "O teu site ainda não está criado",
      description: "Um site profissional é a base da tua presença online. Diz-me o teu setor e crio um rascunho em segundos.",
      action: "Criar site agora", route: "/builder", priority: "high",
    });
  }

  if (stats.publishedPosts === 0 && stats.posts === 0) {
    insights.push({
      id: "no-social", icon: <Share2 className="h-5 w-5 text-neon-blue" />,
      title: "O teu Instagram está vazio",
      description: "Sem presença social, os clientes não te encontram. Posso criar e publicar conteúdo por ti automaticamente.",
      action: "Criar conteúdo", route: "/social-media", priority: "medium",
    });
  }

  if (stats.leads === 0) {
    insights.push({
      id: "no-leads", icon: <Users className="h-5 w-5 text-neon-blue" />,
      title: "Ainda não tens potenciais clientes registados",
      description: "Começa a registar os teus contactos para que a IA te ajude a gerir o seguimento.",
      action: "Adicionar contacto", route: "/crm", priority: "low",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "all-good", icon: <Sparkles className="h-5 w-5 text-primary" />,
      title: "Tudo a funcionar! 🎉",
      description: "A tua máquina de vendas está ativa. Continua a criar conteúdo e a responder rapidamente aos clientes.",
      action: "Ver Estratégia AI", route: "/strategy", priority: "low",
    });
  }

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "high": return "border-neon-green/30 bg-neon-green/5";
      case "medium": return "border-primary/30 bg-primary/5";
      default: return "border-border";
    }
  };

  const quickStats = [
    { label: "Potenciais Clientes", value: stats.leads, icon: Users, color: "text-neon-blue" },
    { label: "Clientes Quentes", value: stats.hotLeads, icon: Flame, color: "text-neon-green" },
    { label: "Posts Publicados", value: stats.publishedPosts, icon: TrendingUp, color: "text-neon-green" },
    { label: "Projetos", value: stats.projects, icon: Globe, color: "text-primary" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          {profileName ? `Olá, ${profileName} 👋` : "Centro de Comando"}
        </h1>
        <p className="text-muted-foreground mt-1">Aqui está o que a IA identificou para ti hoje.</p>
        {(whatsappActive || metaConnected) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {whatsappActive && (
              <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30 gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                WhatsApp ATIVO
              </Badge>
            )}
            {metaConnected && (
              <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30 gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Meta Ads ATIVO
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {quickStats.map((stat) => (
          <Card key={stat.label} className="glass">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted/50">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold">{loading ? "—" : stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-display font-semibold text-foreground">Sugestões da IA</h2>
        </div>
        <div className="space-y-4">
          {insights.map((insight) => (
            <Card 
              key={insight.id} 
              className={`glass transition-all hover:scale-[1.01] cursor-pointer ${getPriorityStyle(insight.priority)}`}
              onClick={() => navigate(insight.route)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-muted/50 shrink-0">{insight.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground mb-1">{insight.title}</h3>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0 text-primary gap-1">
                    {insight.action}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Presença Online
            </CardTitle>
            <CardDescription>Estado das tuas publicações nas redes sociais</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">Prontos para publicar</span>
                <span className="font-semibold text-primary">{loading ? "—" : stats.draftPosts}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">Já publicados</span>
                <span className="font-semibold text-neon-green">{loading ? "—" : stats.publishedPosts}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Potenciais Clientes
            </CardTitle>
            <CardDescription>Contactos recebidos e classificados pela IA</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">Total de contactos</span>
                <span className="font-semibold text-neon-blue">{loading ? "—" : stats.leads}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-neon-green/10 border border-neon-green/30">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-neon-green" />
                  <span className="text-sm font-medium">Clientes QUENTES</span>
                </div>
                <span className="font-bold text-neon-green">{loading ? "—" : stats.hotLeads}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
