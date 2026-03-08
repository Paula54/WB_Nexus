import { ShieldCheck } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { TaskAssignment } from "@/components/admin/TaskAssignment";

export default function Admin() {
  const { isAdmin, loading } = useUserRole();

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          Painel de Administração
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestão de tarefas, freelancers e projetos
        </p>
      </div>
      <TaskAssignment />
    </div>
  );
}
