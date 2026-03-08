import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";

interface Freelancer {
  user_id: string;
  email?: string;
  full_name?: string;
}

interface Project {
  id: string;
  name: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  project_id: string;
  freelancer_notes: string | null;
  created_at: string;
}

export function TaskAssignment() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newFreelancerId, setNewFreelancerId] = useState("");
  const [newPriority, setNewPriority] = useState("medium");

  useEffect(() => {
    if (!user || !isAdmin) return;
    fetchData();
  }, [user, isAdmin]);

  async function fetchData() {
    const [tasksRes, projectsRes, freelancersRes] = await Promise.all([
      supabase.from("tasks" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name"),
      supabase.from("user_roles" as any).select("user_id").eq("role", "freelancer"),
    ]);

    setTasks((tasksRes.data as any[]) || []);
    setProjects((projectsRes.data as any[]) || []);

    // Fetch freelancer profiles
    if (freelancersRes.data && (freelancersRes.data as any[]).length > 0) {
      const fIds = (freelancersRes.data as any[]).map((f: any) => f.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", fIds);

      setFreelancers(
        fIds.map((uid: string) => {
          const profile = (profiles || []).find((p: any) => p.user_id === uid);
          return {
            user_id: uid,
            full_name: profile?.full_name || uid.slice(0, 8),
          };
        })
      );
    }

    setLoading(false);
  }

  async function createTask() {
    if (!newTitle || !newProjectId) {
      toast.error("Título e projeto são obrigatórios");
      return;
    }

    const { error } = await supabase.from("tasks" as any).insert({
      title: newTitle,
      description: newDesc || null,
      project_id: newProjectId,
      assigned_to: newFreelancerId || null,
      assigned_by: user!.id,
      priority: newPriority,
    } as any);

    if (error) {
      toast.error("Erro ao criar tarefa: " + error.message);
      return;
    }

    toast.success("Tarefa criada com sucesso");
    setDialogOpen(false);
    setNewTitle("");
    setNewDesc("");
    setNewProjectId("");
    setNewFreelancerId("");
    setNewPriority("medium");
    fetchData();
  }

  async function deleteTask(id: string) {
    const { error } = await supabase.from("tasks" as any).delete().eq("id", id);
    if (error) {
      toast.error("Erro ao eliminar tarefa");
      return;
    }
    toast.success("Tarefa eliminada");
    fetchData();
  }

  if (!isAdmin) return null;
  if (loading) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="w-5 h-5" />
          Gestão de Tarefas (Admin)
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Nova Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Tarefa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Revisão do site" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Detalhes da tarefa..." />
              </div>
              <div>
                <Label>Projeto</Label>
                <Select value={newProjectId} onValueChange={setNewProjectId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar projeto" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Freelancer</Label>
                <Select value={newFreelancerId} onValueChange={setNewFreelancerId}>
                  <SelectTrigger><SelectValue placeholder="Atribuir a..." /></SelectTrigger>
                  <SelectContent>
                    {freelancers.map((f) => (
                      <SelectItem key={f.user_id} value={f.user_id}>
                        {f.full_name || f.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createTask} className="w-full">Criar Tarefa</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma tarefa criada ainda.</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const freelancer = freelancers.find((f) => f.user_id === task.assigned_to);
              const project = projects.find((p) => p.id === task.project_id);
              return (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{task.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{project?.name || "—"}</span>
                      <span>•</span>
                      <span>{freelancer?.full_name || "Não atribuído"}</span>
                    </div>
                    {task.freelancer_notes && (
                      <p className="text-xs text-muted-foreground italic mt-1">📝 {task.freelancer_notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {task.status === "pending" ? "Pendente" : task.status === "in_progress" ? "Em Progresso" : "Concluído"}
                    </Badge>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteTask(task.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
