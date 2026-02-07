import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Link2, Unlink, Loader2 } from "lucide-react";

interface GoogleAdsAccount {
  id: string;
  google_email: string | null;
  google_ads_customer_id: string | null;
  is_active: boolean;
}

export default function GoogleAdsConnect() {
  const { user } = useAuth();
  const [account, setAccount] = useState<GoogleAdsAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const fetchAccount = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("google_ads_accounts" as string)
      .select("id, google_email, google_ads_customer_id, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    setAccount(data as GoogleAdsAccount | null);
    setLoading(false);
  }, [user]);

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (code && state && user) {
      handleOAuthCallback(code);
    }
  }, [user]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  async function handleOAuthCallback(code: string) {
    setConnecting(true);

    // Clean URL
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida");

      const redirectUri = `${window.location.origin}/settings`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-ads-auth`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Conta Google Ads ligada ✅",
          description: result.google_email
            ? `Ligada como ${result.google_email}`
            : "Ligação estabelecida com sucesso!",
        });
        fetchAccount();
      } else {
        toast({
          variant: "destructive",
          title: "Erro na ligação",
          description: result.error || "Não foi possível ligar a conta.",
        });
      }
    } catch (err: unknown) {
      console.error("OAuth callback error:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao processar a autorização do Google.",
      });
    } finally {
      setConnecting(false);
    }
  }

  async function startOAuthFlow() {
    if (!user) return;
    setConnecting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida");

      const redirectUri = `${window.location.origin}/settings`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-ads-auth?redirect_uri=${encodeURIComponent(redirectUri)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (result.auth_url) {
        window.location.href = result.auth_url;
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: result.error || "Não foi possível iniciar a autenticação.",
        });
        setConnecting(false);
      }
    } catch (err) {
      console.error("OAuth start error:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao iniciar o fluxo OAuth.",
      });
      setConnecting(false);
    }
  }

  async function disconnectAccount() {
    if (!account) return;
    setConnecting(true);

    const { error } = await supabase
      .from("google_ads_accounts" as string)
      .update({ is_active: false })
      .eq("id", account.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível desligar a conta.",
      });
    } else {
      toast({ title: "Conta desligada", description: "A ligação ao Google Ads foi removida." });
      setAccount(null);
    }
    setConnecting(false);
  }

  if (loading) {
    return (
      <Card className="glass">
        <CardContent className="p-6 h-32 animate-pulse" />
      </Card>
    );
  }

  return (
    <Card className="glass border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Integração Google Ads
        </CardTitle>
        <CardDescription>
          Liga a tua conta Google para criar e gerir campanhas Google Ads diretamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {account ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className="bg-primary/15 text-primary border-primary/30">
                ✅ Conectado
              </Badge>
              {account.google_email && (
                <span className="text-sm text-muted-foreground">{account.google_email}</span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={disconnectAccount}
              disabled={connecting}
              className="gap-2 text-destructive hover:text-destructive"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              Desligar
            </Button>
          </div>
        ) : (
          <Button
            onClick={startOAuthFlow}
            disabled={connecting}
            className="gap-2"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {connecting ? "A ligar..." : "Ligar Conta Google Ads"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
