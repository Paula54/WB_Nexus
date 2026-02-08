import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Link2, Unlink, Loader2, Save, ListChecks } from "lucide-react";
import GoogleAdsIcon from "./GoogleAdsIcon";
import CustomerIdField from "./CustomerIdField";
import CampaignTester from "./CampaignTester";

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

  // Handle OAuth callback query params (success or error from server-side callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("google_ads_connected");
    const googleEmail = params.get("google_email");
    const error = params.get("google_ads_error");

    if (connected === "true") {
      toast({
        title: "Conta Google Ads ligada ✅",
        description: googleEmail
          ? `Ligada como ${googleEmail}`
          : "Ligação estabelecida com sucesso!",
      });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchAccount();
    } else if (error) {
      toast({
        variant: "destructive",
        title: "Erro na ligação Google Ads",
        description: decodeURIComponent(error),
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [fetchAccount]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  async function startOAuthFlow() {
    if (!user) return;
    setConnecting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida");

      const returnOrigin = window.location.origin;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-ads-auth?return_origin=${encodeURIComponent(returnOrigin)}`,
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
          <GoogleAdsIcon />
          Integração Google Ads
        </CardTitle>
        <CardDescription>
          Liga a tua conta Google para criar e gerir campanhas Google Ads diretamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {account ? (
          <>
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

            <CustomerIdField
              account={account}
              onAccountUpdate={(updated) => setAccount(updated)}
            />

            <CampaignTester
              customerId={account.google_ads_customer_id}
            />
          </>
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
