import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Share2, Instagram, Linkedin, Facebook, Clock, CheckCircle, XCircle, Send, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface SocialPost {
  id: string;
  caption: string;
  platform: string;
  status: string;
  image_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  error_log: string | null;
}

export default function SocialMedia() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    fetchPosts();
  }, [user]);

  async function fetchPosts() {
    if (!user) return;

    const { data, error } = await supabase
      .from("social_posts")
      .select("id, caption, platform, status, image_url, scheduled_at, published_at, created_at, error_log")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching posts:", error);
    } else {
      setPosts(data || []);
    }
    setLoading(false);
  }

  async function publishPost(postId: string) {
    setPublishing(postId);

    try {
      // Call edge function to publish
      const { data, error } = await supabase.functions.invoke("publish-social-post", {
        body: { postId },
      });

      if (error) throw error;

      // Check if response indicates failure
      if (data?.error) {
        toast({
          variant: "destructive",
          title: "Falha na publicação",
          description: data.details?.errors?.[0]?.message || "Não foi possível publicar o post.",
        });
        fetchPosts();
        return;
      }

      toast({
        title: "Post publicado!",
        description: "O post foi publicado com sucesso.",
      });

      fetchPosts();
    } catch (error) {
      console.error("Error publishing post:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível publicar o post. Verifique a conexão.",
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
            <Clock className="h-3 w-3" /> Agendado
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Social Media</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie e publique conteúdo nas redes sociais
        </p>
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="glass animate-pulse">
              <CardContent className="p-4 h-48" />
            </Card>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-8 text-center">
            <Share2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Ainda não tem posts. Use o Nexus Concierge para gerar conteúdo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => (
            <Card key={post.id} className="glass hover:border-primary/50 transition-colors overflow-hidden">
              {post.image_url && (
                <div className="aspect-video bg-muted">
                  <img
                    src={post.image_url}
                    alt="Post preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {getPlatformIcon(post.platform)}
                    <span className="text-sm capitalize">{post.platform}</span>
                  </div>
                  {getStatusBadge(post.status)}
                </div>
                <p className="text-sm line-clamp-3 mb-4">{post.caption}</p>
                
                {/* Error feedback for failed posts */}
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
                          {parseErrorMessage(post.error_log)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(post.created_at), "d MMM, HH:mm", { locale: pt })}
                  </span>
                  {post.status !== "published" && (
                    <Button
                      size="sm"
                      onClick={() => publishPost(post.id)}
                      disabled={publishing === post.id}
                    >
                      {publishing === post.id ? (
                        "A publicar..."
                      ) : (
                        <>
                          <Send className="h-3 w-3 mr-1" />
                          {post.status === "failed" ? "Tentar novamente" : "Publicar"}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
