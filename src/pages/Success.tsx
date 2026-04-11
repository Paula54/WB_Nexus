import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseCustom";
import { CheckCircle, Loader2, Mail } from "lucide-react";

export default function Success() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = (searchParams.get("session_id") || "").trim();
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || loading) return;

    let cancelled = false;

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function syncPurchasedPlan() {
      if (!user) {
        navigate(`/register?session_id=${encodeURIComponent(sessionId)}`, { replace: true });
        return;
      }

      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const { data, error } = await supabase.functions.invoke("check-subscription");

          if (error) {
            throw error;
          }

          if (data?.subscribed) {
            if (!cancelled) {
              navigate("/", { replace: true });
            }
            return;
          }
        } catch (error) {
          console.error("[Success] Subscription sync error:", error);
        }

        if (attempt < 5) {
          await wait(1500);
        }
      }

      if (!cancelled) {
        setSyncError("Recebemos o pagamento, mas a ativação do plano ainda não foi confirmada automaticamente.");
      }
    }

    void syncPurchasedPlan();

    return () => {
      cancelled = true;
    };
  }, [loading, navigate, sessionId, user]);

  if (sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-lg space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            {syncError ? <CheckCircle className="h-10 w-10 text-primary" /> : <Loader2 className="h-10 w-10 text-primary animate-spin" />}
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            {syncError ? "Pagamento recebido" : "A ativar o seu plano..."}
          </h1>
          <p className="text-lg text-muted-foreground">
            {syncError
              ? syncError
              : "Estamos a ligar a compra à sua conta e a redirecionar para o próximo passo."}
          </p>
          {syncError && (
            <Button asChild variant="outline" size="lg" className="mt-4">
              <Link to="/auth">Entrar na App</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-lg space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
          Pagamento Confirmado!
        </h1>
        <p className="text-lg text-muted-foreground">
          O seu plano foi ativado com sucesso. Enviámos um <strong>email de ativação</strong> para o endereço utilizado no checkout.
        </p>

        <div className="bg-muted/50 rounded-lg p-5 space-y-3 text-left">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">Verifique a sua caixa de email</p>
              <p className="text-sm text-muted-foreground">
                Clique no link do email para definir a sua password e aceder ao dashboard. Se não encontrar o email, verifique a pasta de spam.
              </p>
            </div>
          </div>
        </div>

        <Button asChild variant="outline" size="lg" className="mt-4">
          <Link to="/auth">
            Já tenho conta — Fazer Login
          </Link>
        </Button>
      </div>
    </div>
  );
}
