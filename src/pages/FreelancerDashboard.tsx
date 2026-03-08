import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, Clock, CheckCircle2, AlertCircle, MessageSquare, Gauge } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectPerformanceTab } from "@/components/performance/ProjectPerformanceTab";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  freelancer_notes: string | null;
  due_date: string | null;
  project_id: string;
  created_at: string;
  project_name?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30", icon: Clock },
  in_progress: { label: "Em Progresso", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: AlertCircle },
  completed: { label: "Concluído", color: "bg-green-500/10 text-green-600 border-green-500/30", icon: CheckCircle2 },
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-orange-500/10 text-orange-600",
  high: "bg-destructive/10 text-destructive",
};

export default function FreelancerDashboard() {
  const { user } = useAuth();
  const { isFreelancer, loading: roleLoading } = useUserRole();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchTasks();
  }, [user]);

  async function fetchTasks() {
    const { data, error } = await supabase
      .from("tasks" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks:", error);
      setLoading(false);
      return;
    }

    if (data) {
      // Fetch project names
      const projectIds = [...new Set((data as any[]).map((t: any) => t.project_id))];
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);

      const projectMap = new Map((projects || []).map((p: any) => [p.id, p.name]));

      setTasks(
        (data as any[]).map((t: any) => ({
          ...t,
          project_name: projectMap.get(t.project_id) || "Projeto desconhecido",
        }))
      );
    }
    setLoading(false);
  }

  async function updateStatus(taskId: string, newStatus: string) {
    const { error } = await supabase
      .from("tasks" as any)
      .update({ status: newStatus } as any)
      .eq("id", taskId);

    if (error) {
      toast.error("Erro ao atualizar estado");
      return;
    }
    toast.success("Estado atualizado");
    fetchTasks();
  }

  async function saveNotes(taskId: string) {
    const { error } = await supabase
      .from("tasks" as any)
      .update({ freelancer_notes: noteText } as any)
      .eq("id", taskId);

    if (error) {
      toast.error("Erro ao guardar notas");
      return;
    }
    toast.success("Notas guardadas");
    setEditingNotes(null);
    fetchTasks();
  }

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isFreelancer) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground text-lg">Não tens permissão para aceder a esta área.</p>
      </div>
    );
  }

  const pending = tasks.filter((t) => t.status === "pending");
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const completed = tasks.filter((t) => t.status === "completed");

  // Group tasks by project
  const projectGroups = tasks.reduce<Record<string, { name: string; tasks: Task[] }>>((acc, task) => {
    if (!acc[task.project_id]) {
      acc[task.project_id] = { name: task.project_name || "Projeto", tasks: [] };
    }
    acc[task.project_id].tasks.push(task);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel do Freelancer</h1>
        <p className="text-muted-foreground">Gere os teus projetos atribuídos e tarefas.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-yellow-500/10">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pending.length}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inProgress.length}</p>
              <p className="text-sm text-muted-foreground">Em Progresso</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completed.length}</p>
              <p className="text-sm text-muted-foreground">Concluídos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Ainda não tens tarefas atribuídas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const config = statusConfig[task.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            return (
              <Card key={task.id} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{task.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Projeto: <span className="font-medium text-foreground">{task.project_name}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={priorityColors[task.priority]}>
                        {task.priority === "high" ? "Alta" : task.priority === "medium" ? "Média" : "Baixa"}
                      </Badge>
                      <Badge variant="outline" className={config.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {task.description && (
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  )}

                  {task.due_date && (
                    <p className="text-xs text-muted-foreground">
                      Prazo: {new Date(task.due_date).toLocaleDateString("pt-PT")}
                    </p>
                  )}

                  {/* Status Actions */}
                  <div className="flex flex-wrap gap-2">
                    {task.status !== "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(task.id, "pending")}>
                        Marcar Pendente
                      </Button>
                    )}
                    {task.status !== "in_progress" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(task.id, "in_progress")}>
                        Em Progresso
                      </Button>
                    )}
                    {task.status !== "completed" && (
                      <Button size="sm" variant="default" onClick={() => updateStatus(task.id, "completed")}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Concluir
                      </Button>
                    )}
                  </div>

                  {/* Freelancer Notes */}
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Notas do Freelancer</span>
                    </div>
                    {editingNotes === task.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Descreve o que foi feito, problemas encontrados, etc."
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveNotes(task.id)}>Guardar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingNotes(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors min-h-[40px]"
                        onClick={() => {
                          setEditingNotes(task.id);
                          setNoteText(task.freelancer_notes || "");
                        }}
                      >
                        {task.freelancer_notes || "Clica para adicionar notas..."}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
