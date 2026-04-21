import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { MessageCircle, ExternalLink, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  onConnected?: () => void;
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
      // Save in projects (canonical) AND project_credentials (used by send-whatsapp-reply)
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
      <DialogContent className="sm:max-w-[500px]">
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
          <div className="space-y-4 py-2">
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
              Onde encontro estes IDs?
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
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
