import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  Share2, 
  Instagram, 
  Linkedin, 
  Facebook, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Send, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  Image as ImageIcon,
  CalendarDays
} from "lucide-react";
import { format, isBefore, isToday, isTomorrow, startOfDay, addDays } from "date-fns";
import { pt } from "date-fns/locale";
import type { MarketingStrategyResult } from "@/types/nexus";
import { cn } from "@/lib/utils";

interface SocialPost {
  id: string;
  caption: string;
  platform: string;
  status: string;
  image_url: string | null;
  hashtags: string[] | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  error_log: string | null;
}

interface Project {
  id: string;
  name: string;
  content: MarketingStrategyResult | null;
  created_at: string;
}

export default function SocialMedia() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [latestStrategy, setLatestStrategy] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("posts");
  const [importing, setImporting] = useState(false);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [scheduleDates, setScheduleDates] = useState<Record<string, Date | undefined>>({});
  const [scheduleTimes, setScheduleTimes] = useState<Record<string, string>>({});

  const toggleErrorExpand = (postId: string) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const parseErrorMessage = (errorLog: string | null): string => {
    if (!errorLog) return "Erro desconhecido";
    try {
      const parsed = JSON.parse(errorLog);
      if (parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
        return parsed.errors[0].message || "Erro na publicação";
      }
      if (parsed.message) return parsed.message;
      if (parsed.error) return parsed.error;
      return "Erro na publicação";
    } catch {
      return errorLog.length > 100 ? errorLog.substring(0, 100) + "..." : errorLog;
    }
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        urlRegex.lastIndex = 0;
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80 break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  async function fetchData() {
    if (!user) return;
    
    await Promise.all([fetchPosts(), fetchLatestStrategy()]);
    setLoading(false);
  }

  async function fetchPosts() {
    const { data, error } = await supabase
      .from("social_posts")
      .select("id, caption, platform, status, image_url, hashtags, scheduled_at, published_at, created_at, error_log")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching posts:", error);
    } else {
      setPosts(data || []);
      // Initialize schedule dates from existing posts
      const dates: Record<string, Date | undefined> = {};
      const times: Record<string, string> = {};
      (data || []).forEach(post => {
        if (post.scheduled_at) {
          const date = new Date(post.scheduled_at);
          dates[post.id] = date;
          times[post.id] = format(date, "HH:mm");
        }
      });
      setScheduleDates(dates);
      setScheduleTimes(times);
    }
  }

  async function fetchLatestStrategy() {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, content, created_at")
      .eq("project_type", "marketing")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching strategy:", error);
    } else if (data) {
      setLatestStrategy(data as Project);
    }
  }

  async function importFromStrategy() {
    if (!user || !latestStrategy?.content?.social_media) {
      toast.error("Nenhuma estratégia encontrada", {
        description: "Gera uma estratégia primeiro na página de Estratégia AI."
      });
      return;
    }

    setImporting(true);
    const socialMediaPlan = latestStrategy.content.social_media;
    
    try {
      const postsToCreate = socialMediaPlan.flatMap((day) => {
        const platforms = ["instagram", "facebook", "linkedin"];
        return platforms.map(platform => ({
          user_id: user.id,
          caption: day.caption,
          platform,
          status: "draft",
          hashtags: [],
          image_url: null,
        }));
      });

      const limitedPosts = postsToCreate.slice(0, 9);

      const { error } = await supabase
        .from("social_posts")
        .insert(limitedPosts);

      if (error) throw error;

      toast.success("Posts importados!", {
        description: `${limitedPosts.length} posts criados a partir da estratégia.`
      });

      fetchPosts();
    } catch (error) {
      console.error("Error importing posts:", error);
      toast.error("Erro ao importar", {
        description: "Não foi possível importar os posts da estratégia."
      });
    } finally {
      setImporting(false);
    }
  }

  async function createSinglePost(platform: string, caption: string) {
    if (!user) return;

    const { error } = await supabase
      .from("social_posts")
      .insert({
        user_id: user.id,
        caption,
        platform,
        status: "draft",
      });

    if (error) {
      toast.error("Erro ao criar post");
    } else {
      toast.success("Post criado!");
      fetchPosts();
    }
  }

  async function updatePost(postId: string, caption: string) {
    const { error } = await supabase
      .from("social_posts")
      .update({ caption })
      .eq("id", postId);

    if (error) {
      toast.error("Erro ao atualizar");
    } else {
      toast.success("Post atualizado!");
      setEditingPost(null);
      fetchPosts();
    }
  }

  async function deletePost(postId: string) {
    const { error } = await supabase
      .from("social_posts")
      .delete()
      .eq("id", postId);

    if (error) {
      toast.error("Erro ao eliminar");
    } else {
      toast.success("Post eliminado!");
      fetchPosts();
    }
  }

  function getScheduledDateTime(postId: string): Date | null {
    const date = scheduleDates[postId];
    const time = scheduleTimes[postId] || "10:00";
    if (!date) return null;
    
    const [hours, minutes] = time.split(":").map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  }

  async function publishOrSchedulePost(postId: string) {
    const scheduledDateTime = getScheduledDateTime(postId);
    
    // If there's a scheduled date, save it to the database first
    if (scheduledDateTime) {
      const { error: updateError } = await supabase
        .from("social_posts")
        .update({ scheduled_at: scheduledDateTime.toISOString() })
        .eq("id", postId);
      
      if (updateError) {
        toast.error("Erro ao guardar agendamento");
        return;
      }
    }

    setPublishing(postId);

    try {
      const { data, error } = await supabase.functions.invoke("publish-social-post", {
        body: { postId },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error("Falha na publicação", {
          description: data.details?.errors?.[0]?.message || "Não foi possível publicar o post."
        });
        fetchPosts();
        return;
      }

      if (scheduledDateTime) {
        toast.success("⏰ Post agendado!", {
          description: `Publicação agendada para ${format(scheduledDateTime, "d 'de' MMMM 'às' HH:mm", { locale: pt })}`
        });
      } else {
        toast.success("Post publicado! 🎉", {
          description: "O post foi publicado com sucesso nas redes sociais."
        });
      }

      fetchPosts();
    } catch (error) {
      console.error("Error publishing post:", error);
      toast.error("Erro de conexão", {
        description: "Não foi possível publicar o post. Verifique a conexão."
      });
      fetchPosts();
    } finally {
      setPublishing(null);
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "instagram":
        return <Instagram className="h-4 w-4" />;
      case "linkedin":
        return <Linkedin className="h-4 w-4" />;
      case "facebook":
        return <Facebook className="h-4 w-4" />;
      default:
        return <Share2 className="h-4 w-4" />;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "instagram":
        return "bg-gradient-to-br from-purple-500 to-pink-500";
      case "linkedin":
        return "bg-blue-600";
      case "facebook":
        return "bg-blue-500";
      default:
        return "bg-primary";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground">
            <Clock className="h-3 w-3" /> Rascunho
          </span>
        );
      case "scheduled":
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">
            <CalendarIcon className="h-3 w-3" /> Agendado
          </span>
        );
      case "published":
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
            <CheckCircle className="h-3 w-3" /> Publicado
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">
            <XCircle className="h-3 w-3" /> Falhou
          </span>
        );
      default:
        return null;
    }
  };

  const stats = {
    total: posts.length,
    drafts: posts.filter(p => p.status === "draft").length,
    scheduled: posts.filter(p => p.status === "scheduled").length,
    published: posts.filter(p => p.status === "published").length,
    failed: posts.filter(p => p.status === "failed").length,
  };

  const filteredPosts = (status?: string) => {
    if (!status || status === "all") return posts;
    if (status === "draft") return posts.filter(p => p.status === "draft");
    return posts.filter(p => p.status === status);
  };

  const scheduledPosts = posts
    .filter(p => p.status === "scheduled" && p.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Hoje";
    if (isTomorrow(date)) return "Amanhã";
    return format(date, "EEEE, d 'de' MMMM", { locale: pt });
  };

  const groupedScheduledPosts = scheduledPosts.reduce((acc, post) => {
    const dateKey = startOfDay(new Date(post.scheduled_at!)).toISOString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(post);
    return acc;
  }, {} as Record<string, SocialPost[]>);

  const renderPostCard = (post: SocialPost, showScheduler: boolean = true) => (
    <Card key={post.id} className="glass hover:border-primary/50 transition-colors overflow-hidden group">
      {/* Platform Badge */}
      <div className={`h-1 ${getPlatformColor(post.platform)}`} />
      
      {/* Image Area */}
      {post.image_url ? (
        <div className="aspect-video bg-muted relative">
          <img
            src={post.image_url}
            alt="Post preview"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-video bg-muted/50 flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
        </div>
      )}
      
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            {getPlatformIcon(post.platform)}
            <span className="text-sm capitalize">{post.platform}</span>
          </div>
          {getStatusBadge(post.status)}
        </div>
        
        {/* Caption - Editable */}
        {editingPost === post.id ? (
          <div className="mb-4">
            <Textarea
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={() => updatePost(post.id, editCaption)}>
                Guardar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingPost(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p 
            className="text-sm line-clamp-3 mb-4 cursor-pointer hover:text-primary transition-colors"
            onClick={() => {
              setEditingPost(post.id);
              setEditCaption(post.caption);
            }}
          >
            {post.caption}
          </p>
        )}
        
        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {post.hashtags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="text-xs text-primary">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Date/Time Scheduler */}
        {showScheduler && post.status !== "published" && post.status !== "scheduled" && (
          <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              Agendar publicação
            </p>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !scheduleDates[post.id] && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {scheduleDates[post.id] 
                      ? format(scheduleDates[post.id], "d MMM", { locale: pt })
                      : "Data"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduleDates[post.id]}
                    onSelect={(date) => setScheduleDates(prev => ({ ...prev, [post.id]: date }))}
                    disabled={(date) => isBefore(date, startOfDay(new Date()))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={scheduleTimes[post.id] || "10:00"}
                onChange={(e) => setScheduleTimes(prev => ({ ...prev, [post.id]: e.target.value }))}
                className="w-24"
              />
            </div>
          </div>
        )}

        {/* Scheduled info for scheduled posts */}
        {post.scheduled_at && post.status === "scheduled" && (
          <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-400 flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              Agendado para {format(new Date(post.scheduled_at), "d 'de' MMMM 'às' HH:mm", { locale: pt })}
            </p>
          </div>
        )}
        
        {/* Error feedback */}
        {post.status === "failed" && post.error_log && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <button 
              onClick={() => toggleErrorExpand(post.id)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs font-medium">Erro na publicação</span>
              </div>
              {expandedErrors.has(post.id) ? (
                <ChevronUp className="h-4 w-4 text-destructive" />
              ) : (
                <ChevronDown className="h-4 w-4 text-destructive" />
              )}
            </button>
            {expandedErrors.has(post.id) && (
              <div className="mt-2 pt-2 border-t border-destructive/20">
                <p className="text-xs text-destructive/90 break-words">
                  {renderTextWithLinks(parseErrorMessage(post.error_log))}
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {format(new Date(post.created_at), "d MMM, HH:mm", { locale: pt })}
          </span>
          <div className="flex items-center gap-1">
            {/* Delete button */}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => deletePost(post.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            
            {/* Publish/Schedule button */}
            {post.status !== "published" && post.status !== "scheduled" && (
              <Button
                size="sm"
                onClick={() => publishOrSchedulePost(post.id)}
                disabled={publishing === post.id}
                variant={scheduleDates[post.id] ? "secondary" : "default"}
              >
                {publishing === post.id ? (
                  "A processar..."
                ) : scheduleDates[post.id] ? (
                  <>
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    Agendar
                  </>
                ) : (
                  <>
                    <Send className="h-3 w-3 mr-1" />
                    {post.status === "failed" ? "Tentar" : "Publicar"}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Social Media</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie e publique conteúdo nas redes sociais
          </p>
        </div>
        <div className="flex gap-2">
          {latestStrategy?.content?.social_media && (
            <Button 
              variant="outline" 
              onClick={importFromStrategy}
              disabled={importing}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {importing ? "A importar..." : "Importar da Estratégia"}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.drafts}</p>
              <p className="text-xs text-muted-foreground">Rascunhos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.scheduled}</p>
              <p className="text-xs text-muted-foreground">Agendados</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.published}</p>
              <p className="text-xs text-muted-foreground">Publicados</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.failed}</p>
              <p className="text-xs text-muted-foreground">Falhados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Strategy Preview */}
      {latestStrategy?.content?.social_media && (
        <Card className="glass border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Estratégia Ativa: {latestStrategy.name}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {latestStrategy.content.social_media.slice(0, 3).map((day, idx) => (
                <div key={idx} className="flex-1 min-w-[200px] p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{day.day} • {day.theme}</p>
                  <p className="text-sm line-clamp-2">{day.caption}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Create */}
      <Card className="glass">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Criar Post Rápido
          </h3>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="flex items-center gap-2"
              onClick={() => createSinglePost("instagram", "Novo post para Instagram 📸")}
            >
              <Instagram className="h-4 w-4 text-pink-500" />
              Instagram
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="flex items-center gap-2"
              onClick={() => createSinglePost("facebook", "Novo post para Facebook 👥")}
            >
              <Facebook className="h-4 w-4 text-blue-500" />
              Facebook
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="flex items-center gap-2"
              onClick={() => createSinglePost("linkedin", "Novo post para LinkedIn 💼")}
            >
              <Linkedin className="h-4 w-4 text-blue-600" />
              LinkedIn
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="posts">Todos</TabsTrigger>
          <TabsTrigger value="drafts">Rascunhos</TabsTrigger>
          <TabsTrigger value="scheduled">Agendados</TabsTrigger>
          <TabsTrigger value="published">Publicados</TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays className="h-4 w-4 mr-1" />
            Calendário
          </TabsTrigger>
        </TabsList>

        {/* Regular post tabs */}
        {["posts", "drafts", "scheduled", "published"].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="glass animate-pulse">
                    <CardContent className="p-4 h-48" />
                  </Card>
                ))}
              </div>
            ) : filteredPosts(tab === "posts" ? "all" : tab === "drafts" ? "draft" : tab).length === 0 ? (
              <Card className="glass">
                <CardContent className="p-8 text-center">
                  <Share2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {tab === "posts" 
                      ? "Ainda não tens posts. Cria um ou importa da estratégia!"
                      : tab === "scheduled"
                      ? "Nenhum post agendado. Agenda um post usando o seletor de data!"
                      : `Nenhum post ${tab === "drafts" ? "em rascunho" : "publicado"}.`
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPosts(tab === "posts" ? "all" : tab === "drafts" ? "draft" : tab).map((post) => 
                  renderPostCard(post)
                )}
              </div>
            )}
          </TabsContent>
        ))}

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="mt-6">
          {scheduledPosts.length === 0 ? (
            <Card className="glass">
              <CardContent className="p-8 text-center">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">Nenhum post agendado</p>
                <p className="text-sm text-muted-foreground">
                  Agenda um post selecionando uma data no cartão do post na aba "Rascunhos".
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedScheduledPosts).map(([dateKey, dayPosts]) => (
                <div key={dateKey}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 capitalize">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    {getDateLabel(dayPosts[0].scheduled_at!)}
                  </h3>
                  <div className="space-y-3">
                    {dayPosts.map(post => (
                      <Card key={post.id} className="glass">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            {/* Time */}
                            <div className="text-center min-w-[60px]">
                              <p className="text-2xl font-bold text-primary">
                                {format(new Date(post.scheduled_at!), "HH:mm")}
                              </p>
                            </div>
                            
                            {/* Platform & Content */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-6 h-6 rounded-full ${getPlatformColor(post.platform)} flex items-center justify-center text-white`}>
                                  {getPlatformIcon(post.platform)}
                                </div>
                                <span className="text-sm font-medium capitalize">{post.platform}</span>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{post.caption}</p>
                            </div>
                            
                            {/* Actions */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => deletePost(post.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
