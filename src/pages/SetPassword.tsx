import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseCustom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Supabase auto-processes the invite token from the URL hash/params
    // via detectSessionInUrl + PKCE. We wait for the session to resolve.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[SetPassword] Auth event:", event);
      if (session) {
        setSessionReady(true);
        setCheckingSession(false);
      }
    });

    // Also check if session is already available
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      }
      setCheckingSession(false);
    });

    // Timeout after 8 seconds
    const timer = setTimeout(() => {
      setCheckingSession(false);
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: "Password demasiado curta",
        description: "A password deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords não coincidem",
        description: "Por favor confirme a sua password.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast({
        title: "Password definida com sucesso!",
        description: "A redirecionar para o dashboard...",
      });

      // Small delay for UX then navigate
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (error: unknown) {
      console.error("[SetPassword] Error:", error);
      toast({
        title: "Erro ao definir password",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">A validar o seu convite...</p>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-foreground">Link expirado ou inválido</CardTitle>
            <CardDescription>
              O link de convite pode ter expirado. Por favor, contacte o suporte ou faça login se já tem conta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Ir para o Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            Defina a sua Password
          </CardTitle>
          <CardDescription>
            Bem-vindo ao Nexus! Crie uma password para aceder ao seu dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repita a password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Definir Password e Entrar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
