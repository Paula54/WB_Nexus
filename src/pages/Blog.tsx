import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuotaCheck } from "@/hooks/useQuotaCheck";
import { useUsageCredits } from "@/hooks/useUsageCredits";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Plus,
  Sparkles,
  Loader2,
  Pencil,
  Send,
  ArrowLeft,
  FileText,
  Trash2,
} from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  image_url: string | null;
  status: string;
  author_id: string;
  created_at: string;
}

export default function Blog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { checkAndIncrement } = useQuotaCheck();
  const { spendCredits } = useUsageCredits();

  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [creating, setCreating] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog_posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as BlogPost[];
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async (post: { id?: string; title: string; slug: string; content: string; excerpt: string; status: string }) => {
      if (post.id) {
        const { error } = await supabase
          .from("blog_posts" as any)
          .update({ title: post.title, slug: post.slug, content: post.content, excerpt: post.excerpt, status: post.status } as any)
          .eq("id", post.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("blog_posts" as any)
          .insert({ title: post.title, slug: post.slug, content: post.content, excerpt: post.excerpt, status: post.status, author_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog_posts"] });
      toast({ title: "Guardado com sucesso!" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao guardar", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blog_posts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog_posts"] });
      toast({ title: "Post eliminado" });
    },
  });

  const resetForm = () => {
    setEditing(null);
    setCreating(false);
    setTitle("");
    setSlug("");
    setContent("");
    setExcerpt("");
  };

  const openEditor = (post?: BlogPost) => {
    if (post) {
      setEditing(post);
      setTitle(post.title);
      setSlug(post.slug);
      setContent(post.content);
      setExcerpt(post.excerpt ?? "");
    } else {
      setEditing(null);
      setTitle("");
      setSlug("");
      setContent("");
      setExcerpt("");
    }
    setCreating(true);
  };

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) return;

    const allowed = await checkAndIncrement("blog");
    if (!allowed) return;

    const hasCredits = await spendCredits("blog");
    if (!hasCredits) return;

    setAiLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const res = await fetch(
        `https://hqyuxponbobmuletqshq.supabase.co/functions/v1/generate-blog-post`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ topic: aiTopic }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar");

      setTitle(data.title || "");
      setSlug(data.slug || "");
      setContent(data.content || "");
      setExcerpt(data.excerpt || "");
      setAiOpen(false);
      setAiTopic("");
      setCreating(true);
      toast({ title: "Artigo gerado com IA! ✨", description: "Revê e edita antes de publicar." });
    } catch (err: any) {
      toast({ title: "Erro na geração", description: err.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = (status: string) => {
    if (!title.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    saveMutation.mutate({ id: editing?.id, title, slug: finalSlug, content, excerpt, status });
  };

  // Editor view
  if (creating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={resetForm}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold">
            {editing ? "Editar Artigo" : "Novo Artigo"}
          </h1>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do artigo" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Slug (URL)</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="titulo-do-artigo" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Excerpt (SEO)</label>
            <Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Resumo curto para motores de busca" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Conteúdo (Markdown)</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreve o teu artigo aqui..."
              className="mt-1 min-h-[400px] font-mono text-sm"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={() => handleSave("draft")} variant="secondary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Guardar Rascunho
            </Button>
            <Button onClick={() => handleSave("published")} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Publicar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            Blog
          </h1>
          <p className="text-muted-foreground mt-1">Gere e publica artigos otimizados para SEO</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={aiOpen} onOpenChange={setAiOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar com IA
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Gerar Artigo com IA
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium">Tema do Artigo</label>
                  <Input
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="Ex: Como melhorar o SEO do meu negócio local"
                    className="mt-1"
                    onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
                  />
                </div>
                <Button onClick={handleAiGenerate} disabled={aiLoading || !aiTopic.trim()} className="w-full">
                  {aiLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      A gerar artigo...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Gerar Artigo
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => openEditor()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Artigo
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : posts.length === 0 ? (
        <Card className="glass border-dashed border-muted-foreground/20">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Ainda não tens artigos. Começa por gerar um com IA!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="glass hover:border-primary/30 transition-colors">
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{post.title}</h3>
                    <Badge variant={post.status === "published" ? "default" : "secondary"} className="text-xs shrink-0">
                      {post.status === "published" ? "Publicado" : "Rascunho"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{post.excerpt || post.slug}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {new Date(post.created_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(post)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteMutation.mutate(post.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
