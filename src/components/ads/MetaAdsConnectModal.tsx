import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ExternalLink, Shield, Loader2 } from "lucide-react";

interface MetaAdsConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  onConnected: () => void;
}

export default function MetaAdsConnectModal({
  open,
  onOpenChange,
  projectId,
  onConnected,
}: MetaAdsConnectModalProps) {
  const [accountId, setAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!accountId.trim() || !accessToken.trim()) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preenche o ID da Conta e o Token de Acesso.",
      });
      return;
    }

    if (!projectId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nenhum projeto selecionado. Cria um projeto primeiro.",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          meta_ads_account_id: accountId.trim(),
          meta_access_token: accessToken.trim(),
        })
        .eq("id", projectId);

      if (error) throw error;

      toast({ title: "✅ Meta Ads conectado com sucesso!" });
      onConnected();
      onOpenChange(false);
      setAccountId("");
      setAccessToken("");
    } catch (error) {
      console.error("Error saving Meta Ads credentials:", error);
      toast({
        variant: "destructive",
        title: "Erro ao guardar",
        description: "Não foi possível guardar as credenciais. Tenta novamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Conectar Meta Ads API
          </DialogTitle>
          <DialogDescription>
            Liga a tua conta de anúncios Meta para lançar campanhas reais no
            Facebook e Instagram.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Como obter as credenciais:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Acede ao{" "}
                <a
                  href="https://business.facebook.com/settings/ad-accounts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center gap-0.5"
                >
                  Meta Business Suite
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Copia o ID da Conta de Anúncios (formato: act_XXXXXXXXX)</li>
              <li>
                Gera um Token de Acesso no{" "}
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center gap-0.5"
                >
                  Graph API Explorer
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-account-id">ID da Conta de Anúncios</Label>
            <Input
              id="meta-account-id"
              placeholder="act_123456789"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-access-token">Token de Acesso</Label>
            <Input
              id="meta-access-token"
              type="password"
              placeholder="EAAxxxxxxx..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              O token é guardado de forma segura e apenas acessível por ti.
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={saving || !accountId.trim() || !accessToken.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                A guardar...
              </>
            ) : (
              "Conectar Meta Ads"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
