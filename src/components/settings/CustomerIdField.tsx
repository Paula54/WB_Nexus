import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface GoogleAdsAccount {
  id: string;
  google_email: string | null;
  google_ads_customer_id: string | null;
  is_active: boolean;
}

interface CustomerIdFieldProps {
  account: GoogleAdsAccount;
  onAccountUpdate: (account: GoogleAdsAccount) => void;
}

export default function CustomerIdField({ account, onAccountUpdate }: CustomerIdFieldProps) {
  const [customerId, setCustomerId] = useState(account.google_ads_customer_id || "");
  const [saving, setSaving] = useState(false);

  async function saveCustomerId() {
    const cleaned = customerId.replace(/-/g, "");
    if (!/^\d{10}$/.test(cleaned)) {
      toast({
        variant: "destructive",
        title: "Formato inválido",
        description: "O Customer ID deve ter 10 dígitos (ex: 123-456-7890).",
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("google_ads_accounts" as string)
      .update({ google_ads_customer_id: customerId })
      .eq("id", account.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível guardar o Customer ID.",
      });
    } else {
      toast({
        title: "Customer ID guardado ✅",
        description: `ID ${customerId} associado à tua conta.`,
      });
      onAccountUpdate({ ...account, google_ads_customer_id: customerId });
    }
    setSaving(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
    const formatted = raw.replace(/(\d{3})(\d{3})(\d{0,4})/, (_, a, b, c) =>
      c ? `${a}-${b}-${c}` : b ? `${a}-${b}` : a
    );
    setCustomerId(formatted);
  }

  return (
    <div className="border-t border-border/50 pt-4 space-y-3">
      <div className="space-y-2">
        <Label htmlFor="google_ads_customer_id" className="text-sm">
          Customer ID do Google Ads
        </Label>
        <div className="flex gap-2">
          <Input
            id="google_ads_customer_id"
            value={customerId}
            onChange={handleChange}
            placeholder="123-456-7890"
            maxLength={12}
            className="font-mono"
          />
          <Button
            size="default"
            variant="secondary"
            disabled={saving || !customerId || customerId === account.google_ads_customer_id}
            onClick={saveCustomerId}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Encontras o teu Customer ID no canto superior direito do painel Google Ads (formato: XXX-XXX-XXXX).
        </p>
      </div>
    </div>
  );
}
