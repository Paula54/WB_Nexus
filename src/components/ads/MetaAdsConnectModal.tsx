import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Facebook, Loader2, CheckCircle2 } from "lucide-react";

interface MetaAdsConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  onConnected: () => void;
}

interface AdAccount {
  id: string;
  name: string;
  status: number;
}

export default function MetaAdsConnectModal({
  open,
  onOpenChange,
  projectId,
  onConnected,
}: MetaAdsConnectModalProps) {
  const [connecting, setConnecting] = useState(false);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selecting, setSelecting] = useState<string | null>(null);

  // Handle OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("meta_ads_connected");
    const accountName = params.get("meta_account_name");
    const error = params.get("meta_ads_error");
    const pickAccount = params.get("meta_ads_pick_account");
    const accountsJson = params.get("meta_accounts");

    if (connected === "true") {
      toast({
        title: "✅ Meta Ads conectado!",
        description: accountName
          ? `Conta selecionada: ${accountName}`
          : "Ligação estabelecida com sucesso.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
      onConnected();
    } else if (pickAccount === "true" && accountsJson) {
      try {
        const accounts = JSON.parse(decodeURIComponent(accountsJson));
        setAdAccounts(accounts);
      } catch (e) {
        console.error("Failed to parse ad accounts:", e);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      toast({
        variant: "destructive",
        title: "Erro na ligação Meta Ads",
        description: decodeURIComponent(error),
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [onConnected]);

  async function startMetaOAuth() {
    setConnecting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida");

      const returnOrigin = window.location.origin;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-ads-auth?return_origin=${encodeURIComponent(returnOrigin)}`,
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
      console.error("Meta OAuth start error:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao iniciar o fluxo de autenticação.",
      });
      setConnecting(false);
    }
  }

  async function selectAdAccount(account: AdAccount) {
    if (!projectId) return;
    setSelecting(account.id);

    try {
      const { error } = await supabase
        .from("projects")
        .update({ meta_ads_account_id: account.id })
        .eq("id", projectId);

      if (error) throw error;

      toast({ title: "✅ Conta selecionada!", description: account.name || account.id });
      setAdAccounts([]);
      onConnected();
      onOpenChange(false);
    } catch (err) {
      console.error("Error selecting ad account:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível selecionar a conta.",
      });
    } finally {
      setSelecting(null);
    }
  }

  // Account picker view
  if (adAccounts.length > 0) {
    return (
      <Dialog open={true} onOpenChange={() => setAdAccounts([])}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Facebook className="h-5 w-5 text-[#1877F2]" />
              Seleciona a Conta de Anúncios
            </DialogTitle>
            <DialogDescription>
              Encontrámos {adAccounts.length} conta{adAccounts.length > 1 ? "s" : ""} de anúncios. Escolhe a que queres usar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {adAccounts.map((account) => (
              <Button
                key={account.id}
                variant="outline"
                className="w-full justify-between h-auto p-4 text-left"
                disabled={selecting !== null}
                onClick={() => selectAdAccount(account)}
              >
                <div>
                  <p className="font-medium text-foreground">{account.name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{account.id}</p>
                </div>
                {selecting === account.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-[#1877F2]" />
            Conectar Meta Ads
          </DialogTitle>
          <DialogDescription>
            Liga a tua conta do Facebook para gerir anúncios no Facebook e Instagram automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">O que vais autorizar:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Gestão e leitura de anúncios</li>
              <li>Publicação no Facebook e Instagram</li>
              <li>Acesso às tuas páginas de negócio</li>
            </ul>
            <p className="text-xs">
              Podes revogar o acesso a qualquer momento nas definições do Facebook.
            </p>
          </div>

          <Button
            onClick={startMetaOAuth}
            className="w-full gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-white"
            size="lg"
            disabled={connecting}
          >
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                A redirecionar...
              </>
            ) : (
              <>
                <Facebook className="h-5 w-5" />
                Conectar com Facebook
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
