import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Rocket, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseCustom";

export default function Success() {
  const [searchParams] = useSearchParams();
  const [authStatus, setAuthStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;

    // Check if user already has an active session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        console.log("[Success] User already authenticated");
        setAuthStatus("done");
        return;
      }

      // No session — call the edge function to generate one
      setAuthStatus("loading");
      fetch("https://hqyuxponbobmuletqshq.supabase.co/functions/v1/generate-stripe-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      })
        .then((res) => res.json())
        .then(async (data) => {
          if (data.access_token && data.refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token: data.access_token,
              refresh_token: data.refresh_token,
            });
            if (error) {
              console.error("[Success] setSession failed:", error.message);
              setAuthStatus("error");
            } else {
              console.log("[Success] Session set successfully");
              setAuthStatus("done");
            }
          } else {
            console.warn("[Success] No tokens returned:", data);
            setAuthStatus("error");
          }
        })
        .catch((err) => {
          console.error("[Success] Edge function error:", err);
          setAuthStatus("error");
        });
    });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-lg space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
          Bem-vindo ao <span className="text-primary">Nexus OS</span>!
        </h1>
        <p className="text-lg text-muted-foreground">
          Pagamento confirmado com sucesso. O seu ecossistema digital está a ser preparado — em segundos terá tudo pronto para começar a crescer.
        </p>

        {authStatus === "loading" && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>A preparar o seu acesso...</span>
          </div>
        )}

        {authStatus === "done" && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Rocket className="h-4 w-4 text-primary" />
            <span>O seu plano já está ativo.</span>
          </div>
        )}

        {authStatus === "error" && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Rocket className="h-4 w-4 text-primary" />
            <span>O seu plano está ativo. Faça login para aceder ao dashboard.</span>
          </div>
        )}

        {authStatus !== "loading" && (
          <Button asChild size="lg" className="mt-4">
            <Link to={authStatus === "done" ? "/" : "/auth"}>
              {authStatus === "done" ? "Ir para o Dashboard" : "Fazer Login"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
