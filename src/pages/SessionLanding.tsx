import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseCustom";

export default function SessionLanding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleSession() {
      // 1) Check for explicit tokens in query params (from generate-stripe-session or external site)
      const access_token = searchParams.get("access_token");
      const refresh_token = searchParams.get("refresh_token");

      // 2) Check for Supabase confirmation email params (token_hash + type)
      const token_hash = searchParams.get("token_hash");
      const type = searchParams.get("type");

      // 3) Check for hash fragment tokens (Supabase implicit flow)
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.replace("#", ""));
      const hashAccessToken = hashParams.get("access_token");
      const hashRefreshToken = hashParams.get("refresh_token");

      try {
        // Path A: Explicit query param tokens
        if (access_token && refresh_token) {
          console.log("[SessionLanding] Setting session from query params");
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
        }
        // Path B: Hash fragment tokens (e.g. #access_token=...&refresh_token=...)
        else if (hashAccessToken && hashRefreshToken) {
          console.log("[SessionLanding] Setting session from hash fragment");
          const { error } = await supabase.auth.setSession({
            access_token: hashAccessToken,
            refresh_token: hashRefreshToken,
          });
          if (error) throw error;
        }
        // Path C: Email confirmation via token_hash (signup, recovery, invite, magiclink)
        else if (token_hash && type) {
          console.log("[SessionLanding] Verifying OTP from confirmation email, type:", type);
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as "signup" | "recovery" | "invite" | "magiclink" | "email",
          });
          if (error) throw error;
        }
        // Path D: No tokens — maybe Supabase already processed them via detectSessionInUrl
        else {
          console.log("[SessionLanding] No tokens found, checking existing session...");
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.warn("[SessionLanding] No session found, redirecting to login");
            if (!cancelled) navigate("/auth", { replace: true });
            return;
          }
          console.log("[SessionLanding] Existing session found");
        }

        // Success — clean URL and navigate to dashboard
        if (!cancelled) {
          console.log("[SessionLanding] Session validated, redirecting to dashboard");
          window.history.replaceState({}, "", "/session");
          navigate("/", { replace: true });
        }
      } catch (err: any) {
        console.error("[SessionLanding] Error:", err.message || err);
        if (!cancelled) {
          setError(err.message || "Erro inesperado");
          setTimeout(() => navigate("/auth", { replace: true }), 3000);
        }
      }
    }

    handleSession();
    return () => { cancelled = true; };
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
