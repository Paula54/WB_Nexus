import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Share2, Instagram, Linkedin, Facebook, Clock, CheckCircle, XCircle, Send } from "lucide-react";
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
}

export default function SocialMedia() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, [user]);

  async function fetchPosts() {
    if (!user) return;

    const { data, error } = await supabase
      .from("social_posts")
      .select("*")
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
      const { error } = await supabase.functions.invoke("publish-social-post", {
        body: { postId },
      });

      if (error) throw error;

      // Update local state
      await supabase
        .from("social_posts")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", postId);

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
        description: "Não foi possível publicar o post.",
      });
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
                          Publicar
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
