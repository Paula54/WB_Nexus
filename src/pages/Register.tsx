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
  const [showActivationMessage, setShowActivationMessage] = useState(false);
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

  // Validate the Stripe session on mount with retry logic
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    async function callEdgeFunction(): Promise<{ data: any; error: Error | null }> {
      const prodUrl = 'https://hqyuxponbobmuletqshq.supabase.co';
      const prodAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxeXV4cG9uYm9ibXVsZXRxc2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjM4MTUsImV4cCI6MjA4Njk5OTgxNX0.PR0gfHWMQnFjqnf2TiHSudmJ0k6fnlf8x16AK94jWN4';
      const response = await fetch(`${prodUrl}/functions/v1/generate-stripe-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": prodAnonKey },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await response.json();
      return { data, error: response.ok ? null : new Error(data?.error || "Edge function error") };
    }

    async function validateSession() {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (cancelled) return;
        try {
          console.log(`[Register] Validating Stripe session (attempt ${attempt}/${MAX_RETRIES}):`, sessionId);
          const { data, error } = await callEdgeFunction();
          if (cancelled) return;

          if (error) {
            console.warn(`[Register] Attempt ${attempt} failed:`, error.message);
            if (attempt < MAX_RETRIES) {
              await new Promise(r => setTimeout(r, RETRY_DELAY));
              continue;
            }
            setSessionValidation({ status: "error", message: "Estamos a processar o seu acesso, aguarde um momento..." });
            return;
          }

          if (data?.success && data.access_token && data.refresh_token) {
            console.log("[Register] Session tokens received, setting session...");
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: data.access_token,
              refresh_token: data.refresh_token,
            });
            if (sessionError) {
              console.error("[Register] Failed to set session:", sessionError);
              setSessionValidation({ status: "error", message: "Erro ao iniciar sessão." });
              return;
            }
            setSessionValidation({ status: "valid", accessToken: data.access_token, refreshToken: data.refresh_token });
            return;
          } else if (data?.fallback && data.email) {
            console.log("[Register] Fallback mode - email:", data.email);
            setSessionValidation({ status: "fallback", email: data.email });
            if (data.email) setEmail(data.email);
            return;
          } else {
            console.warn(`[Register] Attempt ${attempt}: no tokens yet`);
            if (attempt < MAX_RETRIES) {
              await new Promise(r => setTimeout(r, RETRY_DELAY));
              continue;
            }
            setSessionValidation({ status: "error", message: "Estamos a processar o seu acesso, aguarde um momento..." });
          }
        } catch (err: any) {
          if (cancelled) return;
          console.error(`[Register] Attempt ${attempt} error:`, err);
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY));
            continue;
          }
          setSessionValidation({ status: "error", message: "Estamos a processar o seu acesso, aguarde um momento..." });
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

  // Normal registration — handles "user already exists" gracefully
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
      const msg = error.message?.toLowerCase() || "";
      const isUserExists = msg.includes("already") || msg.includes("database error") || msg.includes("duplicate") || msg.includes("registered");

      if (isUserExists) {
        // User was created by Stripe webhook — send Magic Link for activation
        console.log("[Register] User already exists, sending activation Magic Link");
        const { error: otpErr } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (otpErr) {
          console.error("[Register] Failed to send magic link:", otpErr);
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível enviar o link de ativação. Tente novamente." });
        } else {
          setShowActivationMessage(true);
        }
      } else {
        toast({ variant: "destructive", title: "Erro no registo", description: error.message });
      }
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

        {/* Activation message after user-exists flow */}
        {showActivationMessage && (
          <Card className="glass">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Compra validada com sucesso! 🎉</CardTitle>
              <CardDescription className="pt-2">
                Para sua segurança, enviámos um link de ativação para o seu e-mail.
                Clique nesse link para confirmar a sua password e entrar no Dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Verifique a sua caixa de entrada (e spam) em <strong>{email}</strong>.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Normal registration form (no session_id, error, or fallback) */}
        {!isValidating && !isInstantAccess && !showActivationMessage && (
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
