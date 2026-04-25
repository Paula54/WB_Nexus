import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { MessageCircle, ExternalLink, Loader2, Facebook, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  onConnected?: () => void;
}

// =====================================================================
// EMBEDDED SIGNUP — Código preparado para ativar quando a App Meta
// estiver aprovada como Tech Provider com WhatsApp Business Product.
// =====================================================================
// Para ativar:
// 1. Definir VITE_META_APP_ID nas variáveis de ambiente
// 2. Definir VITE_META_CONFIG_ID (Configuration ID criado no Meta Business)
// 3. Mudar EMBEDDED_SIGNUP_ENABLED para true
// 4. Carregar o Facebook SDK no index.html
// 5. Criar a edge function `whatsapp-embedded-callback` para trocar o
//    code retornado por um system user access token via Graph API.
// =====================================================================
const EMBEDDED_SIGNUP_ENABLED = false;

declare global {
  interface Window {
    FB?: {
      login: (
        cb: (response: { authResponse?: { code?: string }; status?: string }) => void,
        opts: Record<string, unknown>,
      ) => void;
      init: (opts: Record<string, unknown>) => void;
    };
  }
}

function launchEmbeddedSignup(onCode: (code: string) => void, onError: (msg: string) => void) {
  if (!window.FB) {
    onError("Facebook SDK não carregado.");
    return;
  }
  window.FB.login(
    (response) => {
      if (response.authResponse?.code) {
        onCode(response.authResponse.code);
      } else {
        onError("Login cancelado ou sem código.");
      }
    },
    {
      config_id: import.meta.env.VITE_META_CONFIG_ID,
      response_type: "code",
      override_default_response_type: true,
      extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
    },
  );
}

export function WhatsAppSetupModal({ open, onOpenChange, projectId, onConnected }: Props) {
  const [businessId, setBusinessId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("whatsapp_business_id, whatsapp_phone_number_id")
        .eq("id", projectId)
        .maybeSingle();
      const p = data as Record<string, unknown> | null;
      setBusinessId((p?.whatsapp_business_id as string) || "");
      setPhoneNumberId((p?.whatsapp_phone_number_id as string) || "");
      setLoading(false);
    })();
  }, [open, projectId]);

  const handleEmbeddedSignup = () => {
    launchEmbeddedSignup(
      async (code) => {
        try {
          setSaving(true);
          const { error } = await supabase.functions.invoke("whatsapp-embedded-callback", {
            body: { code, project_id: projectId },
          });
          if (error) throw error;
          toast({ title: "WhatsApp ligado ✅", description: "Conta conectada via Meta." });
          onConnected?.();
          onOpenChange(false);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro desconhecido";
          toast({ title: "Erro", description: msg, variant: "destructive" });
        } finally {
          setSaving(false);
        }
      },
      (msg) => toast({ title: "Login Facebook falhou", description: msg, variant: "destructive" }),
    );
  };

  const handleSave = async () => {
    if (!projectId) {
      toast({ title: "Projeto não encontrado", description: "Configura o DNA primeiro.", variant: "destructive" });
      return;
    }
    if (!businessId.trim() || !phoneNumberId.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preenche o WhatsApp Business ID e o Phone Number ID.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error: projErr } = await supabase
        .from("projects")
        .update({
          whatsapp_business_id: businessId.trim(),
          whatsapp_phone_number_id: phoneNumberId.trim(),
        } as never)
        .eq("id", projectId);
      if (projErr) throw projErr;

      const { data: existingCred } = await supabase
        .from("project_credentials")
        .select("id, user_id")
        .eq("project_id", projectId)
        .maybeSingle();

      const { data: { user } } = await supabase.auth.getUser();

      if (existingCred) {
        await supabase
          .from("project_credentials")
          .update({
            whatsapp_business_id: businessId.trim(),
            whatsapp_phone_number_id: phoneNumberId.trim(),
          })
          .eq("id", (existingCred as { id: string }).id);
      } else if (user) {
        await supabase.from("project_credentials").insert({
          project_id: projectId,
          user_id: user.id,
          whatsapp_business_id: businessId.trim(),
          whatsapp_phone_number_id: phoneNumberId.trim(),
        });
      }

      toast({ title: "WhatsApp ligado ✅", description: "As credenciais foram guardadas com sucesso." });
      onConnected?.();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast({ title: "Erro ao guardar", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-neon-green" />
            Ativar WhatsApp Business
          </DialogTitle>
          <DialogDescription>
            Liga a tua conta WhatsApp Business para receber e responder a clientes via Meta Cloud API.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="tutorial" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tutorial">📘 Tutorial Guiado</TabsTrigger>
              <TabsTrigger value="manual">⚙️ Inserir IDs</TabsTrigger>
            </TabsList>

            {/* === TAB: TUTORIAL VISUAL === */}
            <TabsContent value="tutorial" className="space-y-4 pt-4">
              {EMBEDDED_SIGNUP_ENABLED ? (
                <div className="rounded-lg border border-neon-green/30 bg-neon-green/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-neon-green" />
                    <h3 className="font-semibold">Ligação Automática Disponível</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Clica abaixo para ligar a tua conta WhatsApp Business diretamente com a Meta. Sem copiar IDs.
                  </p>
                  <Button onClick={handleEmbeddedSignup} disabled={saving} className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                    <Facebook className="mr-2 h-4 w-4" />
                    Continuar com Facebook
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    A ligação automática (Login com Facebook) está em aprovação na Meta. Por agora, segue o guia abaixo — leva 3 minutos.
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Onde encontrar os teus IDs (3 passos)</h3>

                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-card/50 p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neon-purple/20 text-neon-purple font-bold text-sm">1</div>
                      <div className="flex-1 space-y-2">
                        <p className="font-medium text-sm">Abre o Meta Business Suite</p>
                        <p className="text-xs text-muted-foreground">
                          Vai à conta WhatsApp Business e copia o <strong>Business Account ID</strong> (no topo da página, por baixo do nome do negócio).
                        </p>
                        <a
                          href="https://business.facebook.com/wa/manage/home/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Abrir Meta Business Suite <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card/50 p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neon-blue/20 text-neon-blue font-bold text-sm">2</div>
                      <div className="flex-1 space-y-2">
                        <p className="font-medium text-sm">Vai a "Phone Numbers"</p>
                        <p className="text-xs text-muted-foreground">
                          Dentro da WhatsApp Account, em <strong>Account Tools → Phone Numbers</strong>, copia o <strong>Phone Number ID</strong> (não é o número de telefone — é um ID numérico ao lado).
                        </p>
                        <a
                          href="https://business.facebook.com/latest/whatsapp_manager/phone_numbers/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Abrir WhatsApp Manager → Phone Numbers <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card/50 p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neon-green/20 text-neon-green font-bold text-sm">3</div>
                      <div className="flex-1 space-y-2">
                        <p className="font-medium text-sm">Cola na tab "Inserir IDs"</p>
                        <p className="text-xs text-muted-foreground">
                          Volta a este modal, abre a tab <strong>⚙️ Inserir IDs</strong> e cola os dois valores. Pronto.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium">📺 Vídeo oficial Meta (2 min)</p>
                  <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
                    <iframe
                      className="h-full w-full"
                      src="https://www.youtube.com/embed/CEt_KMMv3V8"
                      title="Get WhatsApp Business Account ID"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* === TAB: INSERIR IDS === */}
            <TabsContent value="manual" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="wa-business-id">WhatsApp Business Account ID</Label>
                <Input
                  id="wa-business-id"
                  placeholder="ex: 123456789012345"
                  value={businessId}
                  onChange={(e) => setBusinessId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa-phone-id">Phone Number ID</Label>
                <Input
                  id="wa-phone-id"
                  placeholder="ex: 987654321098765"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                />
              </div>
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Documentação oficial Meta <ExternalLink className="h-3 w-3" />
              </a>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar e Ligar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
