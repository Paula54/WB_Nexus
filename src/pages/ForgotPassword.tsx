import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseCustom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Zap, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://nexus.web-business.pt/reset-password",
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h1 className="font-display font-bold text-2xl text-primary">
              NEXUS<span className="text-foreground">Machine</span>
            </h1>
          </div>
        </div>

        <Card className="glass">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {sent ? "Email Enviado" : "Recuperar Password"}
            </CardTitle>
            <CardDescription>
              {sent
                ? `Enviámos um link de recuperação para ${email}. Verifique a sua caixa de correio.`
                : "Introduza o seu email para receber um link de recuperação"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!sent ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "A enviar..." : "Enviar Link de Recuperação"}
                </Button>
              </form>
            ) : (
              <Button className="w-full" variant="outline" onClick={() => setSent(false)}>
                Reenviar email
              </Button>
            )}
            <p className="text-center text-sm text-muted-foreground mt-4">
              <Link to="/auth" className="text-primary hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Voltar ao Login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
