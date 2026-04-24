import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  FileText,
  Facebook,
  Instagram,
} from "lucide-react";

type Platform = "facebook" | "instagram" | string;
type Status = "draft" | "scheduled" | "published" | "failed" | string;

interface SocialPost {
  id: string;
  platform: Platform;
  status: Status;
  caption: string;
  hashtags: string[] | null;
  image_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  error_log: string | null;
  webhook_response: Record<string, unknown> | null;
}

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  published: { label: "Publicado", icon: CheckCircle2, cls: "bg-primary/15 text-primary border-primary/30" },
  scheduled: { label: "Agendado", icon: Clock, cls: "bg-secondary text-secondary-foreground border-border" },
  failed: { label: "Falhou", icon: AlertCircle, cls: "bg-destructive/15 text-destructive border-destructive/30" },
  draft: { label: "Rascunho", icon: FileText, cls: "bg-muted text-muted-foreground border-border" },
};

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform === "facebook") return <Facebook className="h-4 w-4" />;
  if (platform === "instagram") return <Instagram className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function extractMetaError(post: SocialPost): {
  message?: string;
  code?: number | string;
  subcode?: number | string;
  fbtrace_id?: string;
  user_msg?: string;
} | null {
  const wr = post.webhook_response;
  if (!wr || typeof wr !== "object") return null;
  const err = (wr as Record<string, unknown>).error || (wr as Record<string, unknown>).meta_error;
  if (!err || typeof err !== "object") return null;
  const e = err as Record<string, unknown>;
  return {
    message: e.message as string | undefined,
    code: e.code as number | string | undefined,
    subcode: e.error_subcode as number | string | undefined,
    fbtrace_id: e.fbtrace_id as string | undefined,
    user_msg: (e.error_user_msg as string | undefined) || (e.error_user_title as string | undefined),
  };
}

export default function SocialPostsLog() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformTab, setPlatformTab] = useState<string>("all");

  async function fetchPosts() {
    if (!user) return;
    setRefreshing(true);
    const { data, error } = await supabase
      .from("social_posts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[SocialPostsLog] fetch error", error);
    } else {
      setPosts((data as SocialPost[]) || []);
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchPosts(); }, [user]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (platformTab !== "all" && p.platform !== platformTab) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inCaption = p.caption?.toLowerCase().includes(q);
        const inError = (p.error_log || "").toLowerCase().includes(q);
        if (!inCaption && !inError) return false;
      }
      return true;
    });
  }, [posts, platformTab, statusFilter, search]);

  const counts = useMemo(() => {
    const base = { all: posts.length, published: 0, scheduled: 0, failed: 0, draft: 0 };
    for (const p of posts) {
      if (p.status in base) (base as Record<string, number>)[p.status]++;
    }
    return base;
  }, [posts]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Registo de Publicações</h1>
          <p className="text-muted-foreground mt-1">
            Estado, erros e respostas da Meta para Facebook e Instagram
          </p>
        </div>
        <Button variant="outline" onClick={fetchPosts} disabled={refreshing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: "all", label: "Total", value: counts.all },
          { key: "published", label: "Publicados", value: counts.published },
          { key: "scheduled", label: "Agendados", value: counts.scheduled },
          { key: "failed", label: "Falhados", value: counts.failed },
          { key: "draft", label: "Rascunhos", value: counts.draft },
        ].map((k) => (
          <Card
            key={k.key}
            className={`cursor-pointer transition-colors ${statusFilter === k.key ? "border-primary" : ""}`}
            onClick={() => setStatusFilter(k.key)}
          >
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</p>
              <p className="text-2xl font-bold text-foreground">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar na legenda ou no erro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              <SelectItem value="published">Publicado</SelectItem>
              <SelectItem value="scheduled">Agendado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs value={platformTab} onValueChange={setPlatformTab}>
        <TabsList>
          <TabsTrigger value="all">Tudo</TabsTrigger>
          <TabsTrigger value="facebook" className="gap-2"><Facebook className="h-4 w-4" />Facebook</TabsTrigger>
          <TabsTrigger value="instagram" className="gap-2"><Instagram className="h-4 w-4" />Instagram</TabsTrigger>
        </TabsList>

        <TabsContent value={platformTab} className="space-y-3 mt-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Sem publicações para os filtros atuais.
              </CardContent>
            </Card>
          ) : (
            filtered.map((post) => {
              const meta = STATUS_META[post.status] ?? STATUS_META.draft;
              const Icon = meta.icon;
              const metaErr = extractMetaError(post);
              return (
                <Card key={post.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                          <PlatformIcon platform={post.platform} />
                        </div>
                        <div>
                          <CardTitle className="text-base capitalize">{post.platform}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {new Date(post.created_at).toLocaleString("pt-PT")}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={meta.cls}>
                        <Icon className="h-3 w-3 mr-1" />
                        {meta.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">
                      {post.caption || <span className="italic text-muted-foreground">Sem legenda</span>}
                    </p>

                    {post.image_url && (
                      <img
                        src={post.image_url}
                        alt="Pré-visualização"
                        className="h-24 w-24 rounded-md object-cover border border-border"
                        loading="lazy"
                      />
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {post.scheduled_at && (
                        <div>
                          <p className="text-muted-foreground">Agendado para</p>
                          <p className="text-foreground">{new Date(post.scheduled_at).toLocaleString("pt-PT")}</p>
                        </div>
                      )}
                      {post.published_at && (
                        <div>
                          <p className="text-muted-foreground">Publicado em</p>
                          <p className="text-foreground">{new Date(post.published_at).toLocaleString("pt-PT")}</p>
                        </div>
                      )}
                      {post.hashtags && post.hashtags.length > 0 && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Hashtags</p>
                          <p className="text-foreground truncate">{post.hashtags.join(" ")}</p>
                        </div>
                      )}
                    </div>

                    {post.error_log && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                        <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Erro registado
                        </p>
                        <p className="text-sm text-foreground mt-1 break-words">{post.error_log}</p>
                      </div>
                    )}

                    {metaErr && (
                      <div className="rounded-md border border-border bg-muted/50 p-3 space-y-1">
                        <p className="text-xs font-semibold text-foreground">Resposta da Meta</p>
                        {metaErr.user_msg && (
                          <p className="text-sm text-foreground">{metaErr.user_msg}</p>
                        )}
                        {metaErr.message && (
                          <p className="text-xs text-muted-foreground">message: {metaErr.message}</p>
                        )}
                        <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
                          {metaErr.code !== undefined && <span>code: {String(metaErr.code)}</span>}
                          {metaErr.subcode !== undefined && <span>subcode: {String(metaErr.subcode)}</span>}
                          {metaErr.fbtrace_id && <span>fbtrace: {metaErr.fbtrace_id}</span>}
                        </div>
                      </div>
                    )}

                    {post.webhook_response && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Ver resposta completa (JSON)
                        </summary>
                        <pre className="mt-2 p-3 rounded-md bg-muted text-foreground overflow-x-auto max-h-64 text-[11px]">
                          {JSON.stringify(post.webhook_response, null, 2)}
                        </pre>
                      </details>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
