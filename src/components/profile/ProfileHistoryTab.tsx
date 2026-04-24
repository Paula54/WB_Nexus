import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, History, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface ProfileRow {
  id: string;
  full_name: string | null;
  company_name: string | null;
  contact_email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

const fmt = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export default function ProfileHistoryTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, company_name, contact_email, avatar_url, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.warn("[ProfileHistory] error:", error.message);
      }
      setRows((data as ProfileRow[]) ?? []);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const latest = rows[0];
  const hasDuplicates = rows.length > 1;

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Última atualização
            </CardDescription>
            <CardTitle className="text-lg">
              {latest ? fmt(latest.updated_at) : "Sem registos"}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className={hasDuplicates ? "border-destructive/50 bg-destructive/5" : "border-primary/40 bg-primary/5"}>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              {hasDuplicates ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              )}
              Registos para o teu user_id
            </CardDescription>
            <CardTitle className="text-lg flex items-center gap-2">
              {rows.length}
              {hasDuplicates && (
                <Badge variant="destructive" className="text-xs">Duplicados</Badge>
              )}
              {!hasDuplicates && rows.length === 1 && (
                <Badge variant="secondary" className="text-xs">OK</Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {hasDuplicates && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-foreground">
                Foram encontradas {rows.length} linhas para o teu utilizador
              </p>
              <p className="text-muted-foreground">
                A app usa sempre o registo mais recente (por <span className="font-mono text-xs">updated_at</span>),
                mas é recomendável limpar duplicados para evitar inconsistências futuras.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de registos
          </CardTitle>
          <CardDescription>
            Todos os registos da tabela <span className="font-mono text-xs">profiles</span> associados ao teu user_id, ordenados do mais recente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum registo encontrado.
            </p>
          )}
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className={`rounded-lg border p-4 space-y-2 ${
                idx === 0 ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {idx === 0 ? (
                    <Badge className="bg-primary/20 text-primary border-primary/40">Ativo</Badge>
                  ) : (
                    <Badge variant="outline">Antigo</Badge>
                  )}
                  <span className="text-xs font-mono text-muted-foreground">
                    {row.id.slice(0, 8)}…
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Atualizado: {fmt(row.updated_at)}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome: </span>
                  <span className="text-foreground">{row.full_name || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Empresa: </span>
                  <span className="text-foreground">{row.company_name || "—"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Email: </span>
                  <span className="text-foreground">{row.contact_email || "—"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Criado: </span>
                  <span className="text-foreground">{fmt(row.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
