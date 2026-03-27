import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseCustom";

export default function SessionLanding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const access_token = searchParams.get("access_token");
    const refresh_token = searchParams.get("refresh_token");

    if (!access_token || !refresh_token) {
      console.warn("[SessionLanding] Missing tokens, redirecting to login");
      navigate("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          console.error("[SessionLanding] setSession failed:", error.message);
          setError(error.message);
          setTimeout(() => navigate("/login", { replace: true }), 2000);
          return;
        }

        // Clean URL and go to dashboard
        console.log("[SessionLanding] Session set successfully");
        window.history.replaceState({}, "", "/session");
        navigate("/", { replace: true });
      } catch (err: any) {
        console.error("[SessionLanding] Unexpected error:", err);
        setError(err.message || "Erro inesperado");
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {error ? (
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Sessão inválida</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">A redirecionar para login...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="animate-pulse-glow w-16 h-16 rounded-full bg-primary/20" />
          <p className="text-sm text-muted-foreground">A validar sessão...</p>
        </div>
      )}
    </div>
  );
}
