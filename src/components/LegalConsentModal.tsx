import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface LegalConsentModalProps {
  open: boolean;
  onAccept: () => Promise<{ error: any } | undefined>;
}

export function LegalConsentModal({ open, onAccept }: LegalConsentModalProps) {
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const handleAccept = async () => {
    if (!checked) return;
    setLoading(true);
    try {
      const result = await onAccept();
      if (result?.error) {
        console.error("[LegalConsent] Accept error:", result.error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: typeof result.error === "object" && "message" in result.error 
            ? result.error.message 
            : "Não foi possível registar o consentimento. Tenta novamente.",
        });
      }
    } catch (err: any) {
      console.error("[LegalConsent] Unexpected error:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: err?.message || "Erro inesperado. Tenta novamente.",
      });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl">Termos & Condições</DialogTitle>
          <DialogDescription>
            Para continuar a usar o Nexus Machine, precisas aceitar os nossos termos de serviço e política de privacidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground space-y-2 max-h-40 overflow-y-auto">
            <p>Ao aceitar, confirmas que:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Leste e aceitas a <Link to="/privacy" target="_blank" className="text-primary underline">Política de Privacidade</Link></li>
              <li>Leste e aceitas os <Link to="/terms" target="_blank" className="text-primary underline">Termos de Serviço</Link></li>
              <li>Consentes o tratamento dos teus dados de acordo com o RGPD</li>
              <li>Aceitas a <Link to="/devolucoes" target="_blank" className="text-primary underline">Política de Devoluções</Link></li>
            </ul>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground">
              Li e aceito os Termos de Serviço, Política de Privacidade e Política de Devoluções.
            </span>
          </label>

          <Button
            onClick={handleAccept}
            disabled={!checked || loading}
            className="w-full"
          >
            {loading ? "A registar..." : "Aceitar e Continuar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
