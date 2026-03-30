import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Building2, MapPin, Save, Loader2, AlertTriangle, Phone, Upload, Trash2, Image } from "lucide-react";

interface BusinessProfile {
  business_name: string;
  legal_name: string;
  nif: string;
  address_line1: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  website: string;
}

const EMPTY_PROFILE: BusinessProfile = {
  business_name: "",
  legal_name: "",
  nif: "",
  address_line1: "",
  postal_code: "",
  city: "",
  country: "Portugal",
  phone: "",
  website: "",
};

const ALL_FIELDS = Object.keys(EMPTY_PROFILE) as (keyof BusinessProfile)[];

export default function BusinessProfileTab() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("business_profiles" as string)
        .select(ALL_FIELDS.join(", "))
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const d = data as Record<string, unknown>;
        const restored = { ...EMPTY_PROFILE };
        for (const key of ALL_FIELDS) {
          if (d[key] != null) restored[key] = String(d[key]);
        }
        setProfile(restored);
      }
      setLoading(false);
    })();
  }, [user]);

  function validateNIF(nif: string): boolean {
    if (!nif || nif.length !== 9) return false;
    const digits = nif.split("").map(Number);
    if (digits.some(isNaN)) return false;
    const validPrefixes = [1, 2, 3, 5, 6, 7, 8, 9];
    if (!validPrefixes.includes(digits[0])) return false;
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += digits[i] * (9 - i);
    const check = 11 - (sum % 11);
    return digits[8] === (check >= 10 ? 0 : check);
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!profile.nif.trim()) newErrors.nif = "O NIF é obrigatório";
    else if (!validateNIF(profile.nif.trim())) newErrors.nif = "NIF inválido (deve ter 9 dígitos válidos)";
    if (!profile.legal_name.trim()) newErrors.legal_name = "O nome legal é obrigatório";
    if (!profile.address_line1.trim()) newErrors.address_line1 = "A morada fiscal é obrigatória";
    if (!profile.city.trim()) newErrors.city = "A cidade é obrigatória";
    if (!profile.postal_code.trim()) newErrors.postal_code = "O código postal é obrigatório";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!validate()) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Preenche todos os campos assinalados." });
      return;
    }
    setSaving(true);

    // Build payload — empty strings become null
    const payload: Record<string, unknown> = {};
    for (const key of ALL_FIELDS) {
      payload[key] = profile[key].trim() || null;
    }
    if (!payload.country) payload.country = "Portugal";

    const { data: existing } = await supabase
      .from("business_profiles" as string)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let error;
    if (existing) {
      const res = await supabase.from("business_profiles" as string).update(payload).eq("user_id", user.id);
      error = res.error;
    } else {
      const res = await supabase.from("business_profiles" as string).insert({ user_id: user.id, ...payload });
      error = res.error;
    }

    if (error) {
      console.error("[BusinessProfile] Save error:", JSON.stringify(error));
      toast({ variant: "destructive", title: "Erro", description: `Não foi possível guardar: ${error.message}` });
    } else {
      // Stripe sync
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (accessToken) {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL || "https://hqyuxponbobmuletqshq.supabase.co"}/functions/v1/sync-stripe-customer`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify(payload),
          });
        }
      } catch (syncErr) {
        console.warn("Stripe sync skipped:", syncErr);
      }
      toast({ title: "Perfil guardado ✅", description: "Os dados da empresa foram atualizados." });
    }
    setSaving(false);
  }

  const update = (field: keyof BusinessProfile) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile((p) => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  if (loading) return <div className="h-48 animate-pulse bg-muted rounded-lg" />;

  const missingFields = !profile.nif || !profile.legal_name || !profile.address_line1;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {missingFields && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Dados fiscais incompletos</p>
              <p className="text-xs text-muted-foreground">O NIF, nome legal e morada são obrigatórios para efeitos de faturação.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Identidade Fiscal */}
      <Card className="glass border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-primary" />
            Identidade Fiscal
          </CardTitle>
          <CardDescription>Dados legais da empresa para documentos e faturas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Denominação Social <span className="text-destructive">*</span></Label>
              <Input value={profile.legal_name} onChange={update("legal_name")} placeholder="Ex: Astrolábio Mágico Investimentos, Lda." className={errors.legal_name ? "border-destructive" : ""} />
              {errors.legal_name && <p className="text-xs text-destructive">{errors.legal_name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Nome Comercial</Label>
              <Input value={profile.business_name} onChange={update("business_name")} placeholder="Ex: Nexus Machine" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>NIF / NIPC <span className="text-destructive">*</span></Label>
              <Input value={profile.nif} onChange={update("nif")} placeholder="123456789" maxLength={9} className={errors.nif ? "border-destructive" : ""} />
              {errors.nif && <p className="text-xs text-destructive">{errors.nif}</p>}
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input value={profile.country} onChange={update("country")} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Morada Fiscal */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-5 w-5 text-primary" />
            Morada Fiscal
          </CardTitle>
          <CardDescription>Endereço oficial para faturação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Morada Fiscal <span className="text-destructive">*</span></Label>
            <Input value={profile.address_line1} onChange={update("address_line1")} placeholder="Rua, número, andar, complemento" className={errors.address_line1 ? "border-destructive" : ""} />
            {errors.address_line1 && <p className="text-xs text-destructive">{errors.address_line1}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código Postal <span className="text-destructive">*</span></Label>
              <Input value={profile.postal_code} onChange={update("postal_code")} placeholder="1000-001" className={errors.postal_code ? "border-destructive" : ""} />
              {errors.postal_code && <p className="text-xs text-destructive">{errors.postal_code}</p>}
            </div>
            <div className="space-y-2">
              <Label>Cidade <span className="text-destructive">*</span></Label>
              <Input value={profile.city} onChange={update("city")} placeholder="Lisboa" className={errors.city ? "border-destructive" : ""} />
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacto */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-5 w-5 text-primary" />
            Contacto & Web
          </CardTitle>
          <CardDescription>Informações de contacto da empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={profile.phone} onChange={update("phone")} placeholder="+351 912 345 678" />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={profile.website} onChange={update("website")} placeholder="https://exemplo.pt" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving} size="lg" className="w-full md:w-auto">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        {saving ? "A guardar..." : "Guardar Dados da Empresa"}
      </Button>
    </form>
  );
}
