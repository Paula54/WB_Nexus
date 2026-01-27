import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Users, Share2, MessageCircle, Flame, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    projects: 0,
    leads: 0,
    hotLeads: 0,
    posts: 0,
    publishedPosts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;

      try {
        const [projectsRes, leadsRes, hotLeadsRes, postsRes, publishedRes] = await Promise.all([
          supabase.from("projects").select("id", { count: "exact", head: true }),
          supabase.from("leads").select("id", { count: "exact", head: true }),
          supabase.from("leads").select("id", { count: "exact", head: true }).eq("ai_classification", "hot"),
          supabase.from("social_posts").select("id", { count: "exact", head: true }),
          supabase.from("social_posts").select("id", { count: "exact", head: true }).eq("status", "published"),
        ]);

        setStats({
          projects: projectsRes.count ?? 0,
          leads: leadsRes.count ?? 0,
          hotLeads: hotLeadsRes.count ?? 0,
          posts: postsRes.count ?? 0,
          publishedPosts: publishedRes.count ?? 0,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user]);

  const statCards = [
    {
      title: "Projetos",
      value: stats.projects,
      icon: LayoutDashboard,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Leads Totais",
      value: stats.leads,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      title: "Leads Hot",
      value: stats.hotLeads,
      icon: Flame,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      title: "Posts Criados",
      value: stats.posts,
      icon: Share2,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
    {
      title: "Posts Publicados",
      value: stats.publishedPosts,
      icon: TrendingUp,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Centro de Comando
        </h1>
        <p className="text-muted-foreground mt-1">
          Bem-vindo de volta. Aqui está o resumo da sua operação.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">
                    {loading ? "—" : stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Command Center Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outbound Widget */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Outbound - Social Media
            </CardTitle>
            <CardDescription>
              Estado das publicações nas redes sociais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">Posts Agendados</span>
                <span className="font-semibold text-primary">
                  {loading ? "—" : stats.posts - stats.publishedPosts}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">Posts Publicados</span>
                <span className="font-semibold text-green-400">
                  {loading ? "—" : stats.publishedPosts}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inbound Widget */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Inbound - WhatsApp
            </CardTitle>
            <CardDescription>
              Leads recebidos via WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm">Leads Totais</span>
                <span className="font-semibold text-blue-400">
                  {loading ? "—" : stats.leads}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Leads HOT</span>
                </div>
                <span className="font-bold text-orange-500">
                  {loading ? "—" : stats.hotLeads}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
