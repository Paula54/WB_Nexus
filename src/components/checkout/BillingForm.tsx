import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";

interface BusinessForm {
  legal_name: string;
  nif: string;
  address_line1: string;
  city: string;
  postal_code: string;
  country: string;
  phone: string;
}

const EMPTY_FORM: BusinessForm = {
  legal_name: "",
  nif: "",
  address_line1: "",
  city: "",
  postal_code: "",
  country: "Portugal",
  phone: "",
};

interface BillingFormProps {
  onSaved: (saved: boolean) => void;
}

export function BillingForm({ onSaved }: BillingFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<BusinessForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: bp } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (bp) {
        setForm({
          legal_name: bp.legal_name || "",
          nif: bp.nif || "",
          address_line1: bp.address_line1 || "",
          city: bp.city || "",
          postal_code: bp.postal_code || "",
          country: bp.country || "Portugal",
          phone: bp.phone || "",
        });
        if (bp.nif && bp.legal_name && bp.address_line1 && bp.city && bp.postal_code) {
          setSaved(true);
          onSaved(true);
        }
      }
    };
    load();
  }, [user]);

  const handleChange = (field: keyof BusinessForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    onSaved(false);
  };

  const isFormValid =
    form.legal_name.trim().length > 0 &&
    /^\d{9}$/.test(form.nif.trim()) &&
    form.address_line1.trim().length > 0 &&
    form.city.trim().length > 0 &&
    form.postal_code.trim().length > 0;

  const handleSave = async () => {
    if (!user || !isFormValid) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        legal_name: form.legal_name.trim() || null,
        nif: form.nif.trim() || null,
        address_line1: form.address_line1.trim() || null,
        city: form.city.trim() || null,
        postal_code: form.postal_code.trim() || null,
        country: form.country.trim() || null,
        phone: form.phone.trim() || null,
      };

      const { data: existing } = await supabase
        .from("business_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("business_profiles").update(payload).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("business_profiles").insert(payload);
        if (error) throw error;
      }

      setSaved(true);
      onSaved(true);
      toast({ title: "Dados guardados", description: "Dados de faturação atualizados com sucesso." });
    } catch (err) {
      console.error("[BillingForm] Save error:", err);
      toast({ title: "Erro ao guardar", description: "Verifica os dados e tenta novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          Dados de Faturação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="legal_name">Denominação Social *</Label>
          <Input id="legal_name" value={form.legal_name} onChange={(e) => handleChange("legal_name", e.target.value)} placeholder="Ex: Empresa Lda." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nif">NIF * (9 dígitos)</Label>
          <Input id="nif" value={form.nif} onChange={(e) => handleChange("nif", e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="123456789" maxLength={9} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Morada *</Label>
          <Input id="address" value={form.address_line1} onChange={(e) => handleChange("address_line1", e.target.value)} placeholder="Rua / Avenida" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">Cidade *</Label>
            <Input id="city" value={form.city} onChange={(e) => handleChange("city", e.target.value)} placeholder="Lisboa" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal">Código Postal *</Label>
            <Input id="postal" value={form.postal_code} onChange={(e) => handleChange("postal_code", e.target.value)} placeholder="1000-000" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="+351 900 000 000" />
        </div>
        <Button onClick={handleSave} disabled={!isFormValid || saving} className="w-full" variant="outline">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {saved ? "✓ Dados Guardados" : "Guardar Dados de Faturação"}
        </Button>
      </CardContent>
    </Card>
  );
}
