import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseCustom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Zap, Eye, EyeOff, Check, X, Loader2 } from "lucide-react";

function getPasswordStrength(pw: string) {
  let score = 0;
  const checks = {
    length: pw.length >= 8,
    lowercase: /[a-z]/.test(pw),
    uppercase: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  score = Object.values(checks).filter(Boolean).length;
  const label = score <= 1 ? "Fraca" : score <= 2 ? "Razoável" : score <= 3 ? "Média" : score <= 4 ? "Forte" : "Excelente";
  const color = score <= 1 ? "bg-destructive" : score <= 2 ? "bg-orange-500" : score <= 3 ? "bg-yellow-500" : score <= 4 ? "bg-emerald-400" : "bg-emerald-600";
  return { score, label, color, checks };
}

type SessionValidation =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "valid"; accessToken: string; refreshToken: string }
  | { status: "fallback"; email: string }
  | { status: "error"; message: string };

export default function Register() {
  const [searchParams] = useSearchParams();
  const prefillEmail = (searchParams.get("email") || new URLSearchParams(window.location.search).get("email") || "").trim();
  const sessionId = (searchParams.get("session_id") || new URLSearchParams(window.location.search).get("session_id") || "").trim();

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, signUp } = useAuth();
  const navigate = useNavigate();

  const [sessionValidation, setSessionValidation] = useState<SessionValidation>(
    sessionId ? { status: "validating" } : { status: "idle" }
  );

  // Redirect authenticated users (without session_id) to dashboard
  useEffect(() => {
    if (user && !sessionId) {
      navigate("/", { replace: true });
    }
  }, [user, sessionId, navigate]);

  useEffect(() => {
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, [prefillEmail]);

  // Validate the Stripe session on mount if session_id is present
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function validateSession() {
      try {
        console.log("[Register] Validating Stripe session:", sessionId);

        // Call edge function on Lovable Cloud (where it's deployed)
        // Not via supabaseCustom which points to production
        const lovableProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "ubzvsjyfebuqtiwzpcly";
        const lovableAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const edgeFunctionUrl = `https://${lovableProjectId}.supabase.co/functions/v1/generate-stripe-session`;
        
        const response = await fetch(edgeFunctionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": lovableAnonKey,
          },
          body: JSON.stringify({ session_id: sessionId }),
        });
        
        const data = await response.json();
        const error = response.ok ? null : new Error(data?.error || "Edge function error");

        if (cancelled) return;

        if (error) {
          console.error("[Register] Edge function error:", error);
          setSessionValidation({ status: "error", message: "Não foi possível validar o pagamento." });
          return;
        }

        if (data?.success && data.access_token && data.refresh_token) {
          console.log("[Register] Session tokens received, setting session...");
          // Set the session so the user is authenticated
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });

          if (sessionError) {
            console.error("[Register] Failed to set session:", sessionError);
            setSessionValidation({ status: "error", message: "Erro ao iniciar sessão." });
            return;
          }

          setSessionValidation({
            status: "valid",
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
          });
        } else if (data?.fallback && data.email) {
          console.log("[Register] Fallback mode - email:", data.email);
          setSessionValidation({ status: "fallback", email: data.email });
          if (data.email) setEmail(data.email);
        } else {
          setSessionValidation({ status: "error", message: data?.error || "Pagamento não encontrado." });
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("[Register] Validation error:", err);
          setSessionValidation({ status: "error", message: "Erro de rede ao validar pagamento." });
        }
      }
    }

    validateSession();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Instant access: user is authenticated, just needs to set password
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Erro", description: "As passwords não coincidem." });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: "Erro", description: "A password deve ter pelo menos 6 caracteres." });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ variant: "destructive", title: "Erro", description: error.message });
      } else {
        toast({ title: "Password definida!", description: "Bem-vindo à plataforma." });
        navigate("/");
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Normal registration (no session_id or fallback)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Erro", description: "As passwords não coincidem." });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: "Erro", description: "A password deve ter pelo menos 6 caracteres." });
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password);

    if (error) {
      toast({ variant: "destructive", title: "Erro no registo", description: error.message });
    } else {
      toast({ title: "Conta criada!", description: "Pode agora aceder à plataforma." });
      navigate("/");
    }
    setLoading(false);
  };

  const isInstantAccess = sessionValidation.status === "valid";
  const isValidating = sessionValidation.status === "validating";

  // Password strength UI
  const renderPasswordStrength = () => {
    if (!password) return null;
    const { score, label, color, checks } = getPasswordStrength(password);
    return (
      <div className="space-y-2 pt-1">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= score ? color : "bg-muted"}`} />
          ))}
        </div>
        <p className={`text-xs font-medium ${score <= 2 ? "text-destructive" : "text-muted-foreground"}`}>
          Força: {label}
        </p>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {([["length", "8+ caracteres"], ["lowercase", "Minúscula"], ["uppercase", "Maiúscula"], ["number", "Número"], ["special", "Carácter especial"]] as const).map(([key, lbl]) => (
            <li key={key} className="flex items-center gap-1">
              {checks[key] ? <Check className="h-3 w-3 text-emerald-500" /> : <X className="h-3 w-3 text-muted-foreground/50" />}
              {lbl}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse-glow">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-primary">
                NEXUS<span className="text-foreground">Machine</span>
              </h1>
              <p className="text-xs text-muted-foreground">Motor de Marketing Elite</p>
            </div>
          </div>
        </div>

        {/* Validating payment */}
        {isValidating && (
          <Card className="glass">
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">A validar o seu pagamento...</p>
            </CardContent>
          </Card>
        )}

        {/* Validation error */}
        {sessionValidation.status === "error" && (
          <Card className="glass mb-4">
            <CardContent className="py-4">
              <p className="text-sm text-destructive text-center">{sessionValidation.message}</p>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Pode criar a sua conta normalmente abaixo ou verifique o seu e-mail para o link de acesso.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Instant access form (session validated) */}
        {isInstantAccess && (
          <Card className="glass">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Pagamento confirmado! 🎉</CardTitle>
              <CardDescription>
                Defina a sua password para aceder à plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">Email associado à sua compra.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Definir Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {renderPasswordStrength()}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "A configurar..." : "Concluir e Entrar"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Normal registration form (no session_id, error, or fallback) */}
        {!isValidating && !isInstantAccess && (
          <Card className="glass">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Criar conta</CardTitle>
              <CardDescription>
                Junte-se à elite do marketing automatizado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={!!prefillEmail}
                    className={prefillEmail ? "bg-muted cursor-not-allowed" : ""}
                    required
                  />
                  {prefillEmail && (
                    <p className="text-xs text-muted-foreground">Email associado à tua compra.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {renderPasswordStrength()}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "A criar conta..." : "Criar conta"}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Já tem conta?{" "}
                <Link to="/auth" className="text-primary hover:underline">
                  Entrar
                </Link>
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2026 Astrolábio Mágico Investimentos, Lda. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
