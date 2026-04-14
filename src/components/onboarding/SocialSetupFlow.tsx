import { useState, useEffect, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Copy, Check, Facebook, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseCustom";

const FALLBACK_META_APP_ID = "1578338553386945";

// Load Facebook SDK with dynamic App ID
function loadFacebookSDK(appId: string): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).FB) {
      // Re-init with possibly new appId
      (window as any).FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: "v21.0",
      });
      resolve();
      return;
    }

    (window as any).fbAsyncInit = function () {
      (window as any).FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: "v21.0",
      });
      resolve();
    };

    if (!document.getElementById("facebook-jssdk")) {
      const js = document.createElement("script");
      js.id = "facebook-jssdk";
      js.src = "https://connect.facebook.net/pt_PT/sdk.js";
      js.async = true;
      js.defer = true;
      document.head.appendChild(js);
    }
  });
}

function fbLogin(): Promise<{ accessToken: string; userID: string }> {
  return new Promise((resolve, reject) => {
    const FB = (window as any).FB;
    if (!FB) {
      reject(new Error("Facebook SDK não carregado"));
      return;
    }
    FB.login(
      (response: any) => {
        if (response.authResponse) {
          resolve({
            accessToken: response.authResponse.accessToken,
            userID: response.authResponse.userID,
          });
        } else {
          reject(new Error("Login cancelado pelo utilizador"));
        }
      },
      {
        scope:
          "ads_management,ads_read,pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish,business_management",
      }
    );
  });
}

export function SocialSetupFlow({ open, onOpenChange, onHasPage }: SocialSetupFlowProps) {
  const [step, setStep] = useState<Step>("choice");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [generatedBio, setGeneratedBio] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [metaAppId, setMetaAppId] = useState(FALLBACK_META_APP_ID);

  // Fetch meta_client_id from project_credentials
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data: proj } = await supabase
          .from("projects")
          .select("id")
          .limit(1)
          .maybeSingle();
        if (proj) {
          const { data: creds } = await supabase
            .from("project_credentials" as any)
            .select("meta_client_id")
            .eq("project_id", proj.id)
            .maybeSingle();
          const raw = creds as Record<string, unknown> | null;
          if (raw?.meta_client_id && typeof raw.meta_client_id === "string") {
            setMetaAppId(raw.meta_client_id);
          }
        }
      } catch (e) {
        console.warn("Could not fetch meta_client_id, using fallback:", e);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (open && metaAppId) {
      loadFacebookSDK(metaAppId).then(() => setSdkReady(true));
    }
  }, [open, metaAppId]);

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const generateBio = () => {
    if (!businessName.trim() || !category.trim()) {
      toast.error("Preenche o Nome e a Categoria primeiro.");
      return;
    }
    const bio = `${businessName} — ${category}. ${description || "Soluções profissionais para o teu negócio."}`;
    setGeneratedBio(bio);
    setStep("create-guide");
  };

  const handleClose = () => {
    setStep("choice");
    setBusinessName("");
    setCategory("");
    setDescription("");
    setGeneratedBio("");
    onOpenChange(false);
  };

  const connectWithFacebookSDK = useCallback(async (connectionType: "imported" | "created_by_nexus") => {
    setConnecting(true);
    try {
      if (!sdkReady) {
        await loadFacebookSDK(metaAppId);
      }

      // 1. FB.login() — user authorizes, we get a short-lived token
      const fbAuth = await fbLogin();
      toast.info("A processar ligação...");

      // 2. Send token to our edge function for exchange & storage
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida");

      const response = await fetch(
        "https://hqyuxponbobmuletqshq.supabase.co/functions/v1/connect-meta",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            access_token: fbAuth.accessToken,
            connection_type: connectionType,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || data.detail || `HTTP ${response.status}`);
      }

      toast.success("✅ Meta conectado!", {
        description: `Página: ${data.facebook_page_id || "—"} | Token válido até ${data.token_expires_at ? new Date(data.token_expires_at).toLocaleDateString("pt-PT") : "~60 dias"}`,
      });
      handleClose();
      onHasPage();
    } catch (err: any) {
      console.error("Connect Meta error:", err);
      toast.error("Erro ao conectar Meta", {
        description: err.message || "Tenta novamente.",
      });
    } finally {
      setConnecting(false);
    }
  }, [sdkReady, metaAppId, onHasPage]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        {step === "choice" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Facebook className="h-6 w-6 text-neon-blue" />
                Ligar Redes Sociais
              </DialogTitle>
              <DialogDescription>
                Precisamos da tua Página do Facebook para publicar conteúdo e anúncios.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 mt-4">
              <Button
                variant="outline"
                className="h-auto p-5 flex flex-col items-start gap-2 border-neon-blue/30 hover:border-neon-blue/60 hover:bg-neon-blue/5"
                disabled={connecting}
                onClick={() => connectWithFacebookSDK("imported")}
              >
                {connecting ? (
                  <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> A conectar...
                  </span>
                ) : (
                  <>
                    <span className="text-base font-semibold text-foreground">✅ Já tenho uma Página</span>
                    <span className="text-sm text-muted-foreground text-left">
                      Vou autorizar o acesso à minha página do Facebook/Instagram.
                    </span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="h-auto p-5 flex flex-col items-start gap-2 border-neon-purple/30 hover:border-neon-purple/60 hover:bg-neon-purple/5"
                disabled={connecting}
                onClick={() => setStep("create-form")}
              >
                <span className="text-base font-semibold text-foreground">🆕 Não tenho — Quero criar</span>
                <span className="text-sm text-muted-foreground text-left">O Nexus ajuda-te a criar uma em minutos.</span>
              </Button>
            </div>
          </>
        )}

        {step === "create-form" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-neon-purple" />
                Dados do teu Negócio
              </DialogTitle>
              <DialogDescription>
                Preenche estes 3 campos e o Nexus gera uma Bio criativa para ti.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nome do Negócio</Label>
                <Input placeholder="Ex: Padaria do João" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input placeholder="Ex: Restaurante, Imobiliária, Fitness..." value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Breve Descrição <span className="text-muted-foreground">(opcional)</span></Label>
                <Textarea placeholder="O que torna o teu negócio especial?" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <Button onClick={generateBio} className="w-full gap-2 bg-neon-purple hover:bg-neon-purple/90 text-white" size="lg">
                <Sparkles className="h-4 w-4" />
                Gerar Bio & Avançar
              </Button>
            </div>
          </>
        )}

        {step === "create-guide" && (
          <>
            <DialogHeader>
              <DialogTitle>📋 3 Passos para Criar a tua Página</DialogTitle>
              <DialogDescription>Segue estes passos simples e volta aqui quando terminares.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 mt-4">
              {generatedBio && (
                <div className="p-3 rounded-lg border border-neon-purple/30 bg-neon-purple/5">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium text-neon-purple">Bio Gerada pelo Nexus</span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyText(generatedBio, "bio")}>
                      {copiedField === "bio" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <p className="text-sm text-foreground">{generatedBio}</p>
                </div>
              )}

              {[
                { num: 1, text: "Abre a página de criação do Facebook", copyVal: businessName, copyLabel: "nome" },
                { num: 2, text: "Preenche o Nome e a Categoria (cola os dados abaixo)", copyVal: category, copyLabel: "categoria" },
                { num: 3, text: "Cola a Bio gerada e publica a página" },
              ].map((s) => (
                <div key={s.num} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-neon-blue/20 flex items-center justify-center shrink-0">
                    <span className="font-bold text-sm text-neon-blue">{s.num}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{s.text}</p>
                    {s.copyVal && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs mt-1 gap-1" onClick={() => copyText(s.copyVal!, s.copyLabel!)}>
                        {copiedField === s.copyLabel ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        Copiar {s.copyLabel}
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                className="w-full gap-2 border-neon-blue/40 text-neon-blue hover:bg-neon-blue/10"
                onClick={() => window.open("https://www.facebook.com/pages/create", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Abrir Facebook — Criar Página
              </Button>

              <Button
                className="w-full gap-2 bg-neon-green hover:bg-neon-green/90 text-background font-bold"
                size="lg"
                disabled={connecting}
                onClick={() => connectWithFacebookSDK("created_by_nexus")}
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    A conectar...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Já criei! Vamos ligar agora.
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
