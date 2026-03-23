import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Building2, MapPin, Phone, Globe, Save, Loader2, AlertTriangle } from "lucide-react";

interface BusinessProfile {
  legal_name: string;
  trade_name: string;
  nif: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  facebook_url: string;
  instagram_url: string;
  linkedin_url: string;
}

const EMPTY_PROFILE: BusinessProfile = {
  legal_name: "",
  trade_name: "",
  nif: "",
  address_line1: "",
  address_line2: "",
  postal_code: "",
  city: "",
  country: "Portugal",
  phone: "",
  email: "",
  website: "",
  facebook_url: "",
  instagram_url: "",
  linkedin_url: "",
};

const COMPANY_TYPES = [
  { value: "unipessoal", label: "Sociedade Unipessoal por Quotas (Lda.)" },
  { value: "quotas", label: "Sociedade por Quotas (Lda.)" },
  { value: "anonima", label: "Sociedade Anónima (S.A.)" },
  { value: "eni", label: "Empresário em Nome Individual" },
  { value: "freelancer", label: "Trabalhador Independente" },
  { value: "associacao", label: "Associação" },
  { value: "outro", label: "Outro" },
];

export default function BusinessProfileTab() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile>(EMPTY_PROFILE);
  const [companyType, setCompanyType] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("business_profiles" as string)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const d = data as Record<string, unknown>;
        setProfile({
          legal_name: (d.legal_name as string) || "",
          trade_name: (d.trade_name as string) || "",
          nif: (d.nif as string) || "",
          address_line1: (d.address_line1 as string) || "",
          address_line2: (d.address_line2 as string) || "",
          postal_code: (d.postal_code as string) || "",
          city: (d.city as string) || "",
          country: (d.country as string) || "Portugal",
          phone: (d.phone as string) || "",
          email: (d.email as string) || "",
          website: (d.website as string) || "",
          facebook_url: (d.facebook_url as string) || "",
          instagram_url: (d.instagram_url as string) || "",
          linkedin_url: (d.linkedin_url as string) || "",
        });
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
    for (let i = 0; i < 8; i++) {
      sum += digits[i] * (9 - i);
    }
    const check = 11 - (sum % 11);
    const expectedDigit = check >= 10 ? 0 : check;
    return digits[8] === expectedDigit;
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    
    if (!profile.nif.trim()) {
      newErrors.nif = "O NIF é obrigatório";
    } else if (!validateNIF(profile.nif.trim())) {
      newErrors.nif = "NIF inválido (deve ter 9 dígitos válidos)";
    }
    
    if (!profile.legal_name.trim()) {
      newErrors.legal_name = "O nome legal é obrigatório";
    }
    
    if (!profile.address_line1.trim()) {
      newErrors.address_line1 = "A morada fiscal é obrigatória";
    }

    if (!profile.city.trim()) {
      newErrors.city = "A cidade é obrigatória";
    }

    if (!profile.postal_code.trim()) {
      newErrors.postal_code = "O código postal é obrigatório";
    }

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

    const payload = { user_id: user.id, ...profile } as Record<string, unknown>;

    const { error } = await supabase
      .from("business_profiles" as string)
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível guardar o perfil." });
    } else {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (accessToken) {
          await fetch(
            `https://hqyuxponbobmuletqshq.supabase.co/functions/v1/sync-stripe-customer`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                legal_name: profile.legal_name,
                nif: profile.nif,
                address_line1: profile.address_line1,
                address_line2: profile.address_line2,
                postal_code: profile.postal_code,
                city: profile.city,
                country: profile.country,
                phone: profile.phone,
                email: profile.email,
              }),
            }
          );
        }
      } catch (syncErr) {
        console.warn("Stripe sync skipped:", syncErr);
      }
      toast({ title: "Perfil guardado ✅", description: "Os dados da empresa foram atualizados e sincronizados." });
    }
    setSaving(false);
  }

  const update = (field: keyof BusinessProfile) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile((p) => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  if (loading) {
    return <div className="h-48 animate-pulse bg-muted rounded-lg" />;
  }

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
              <Label>Nome Legal / Denominação Social <span className="text-destructive">*</span></Label>
              <Input
                value={profile.legal_name}
                onChange={update("legal_name")}
                placeholder="Ex: Astrolábio Mágico Investimentos, Lda."
                className={errors.legal_name ? "border-destructive" : ""}
              />
              {errors.legal_name && <p className="text-xs text-destructive">{errors.legal_name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Nome Comercial</Label>
              <Input value={profile.trade_name} onChange={update("trade_name")} placeholder="Ex: Nexus Machine" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>NIF / NIPC <span className="text-destructive">*</span></Label>
              <Input
                value={profile.nif}
                onChange={update("nif")}
                placeholder="123456789"
                maxLength={9}
                className={errors.nif ? "border-destructive" : ""}
              />
              {errors.nif && <p className="text-xs text-destructive">{errors.nif}</p>}
            </div>
            <div className="space-y-2">
              <Label>Tipo de Empresa</Label>
              <Select value={companyType} onValueChange={setCompanyType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Label>Linha de Endereço 1 <span className="text-destructive">*</span></Label>
            <Input
              value={profile.address_line1}
              onChange={update("address_line1")}
              placeholder="Rua, número, andar"
              className={errors.address_line1 ? "border-destructive" : ""}
            />
            {errors.address_line1 && <p className="text-xs text-destructive">{errors.address_line1}</p>}
          </div>
          <div className="space-y-2">
            <Label>Linha de Endereço 2</Label>
            <Input value={profile.address_line2} onChange={update("address_line2")} placeholder="Complemento (opcional)" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código Postal <span className="text-destructive">*</span></Label>
              <Input
                value={profile.postal_code}
                onChange={update("postal_code")}
                placeholder="1000-001"
                className={errors.postal_code ? "border-destructive" : ""}
              />
              {errors.postal_code && <p className="text-xs text-destructive">{errors.postal_code}</p>}
            </div>
            <div className="space-y-2">
              <Label>Cidade <span className="text-destructive">*</span></Label>
              <Input
                value={profile.city}
                onChange={update("city")}
                placeholder="Lisboa"
                className={errors.city ? "border-destructive" : ""}
              />
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contactos */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-5 w-5 text-primary" />
            Contactos & Redes Sociais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={profile.phone} onChange={update("phone")} placeholder="+351 912 345 678" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={profile.email} onChange={update("email")} placeholder="geral@empresa.pt" />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={profile.website} onChange={update("website")} placeholder="https://empresa.pt" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Facebook</Label>
              <Input value={profile.facebook_url} onChange={update("facebook_url")} placeholder="https://facebook.com/..." />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input value={profile.instagram_url} onChange={update("instagram_url")} placeholder="https://instagram.com/..." />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn</Label>
              <Input value={profile.linkedin_url} onChange={update("linkedin_url")} placeholder="https://linkedin.com/..." />
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
