import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Building2, MapPin, Phone, Globe, Save, Loader2, BookOpen } from "lucide-react";

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
  complaints_book_url: string;
  dre_url: string;
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
  complaints_book_url: "",
  dre_url: "",
};

export default function BusinessProfileTab() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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
          complaints_book_url: (d.complaints_book_url as string) || "",
          dre_url: (d.dre_url as string) || "",
        });
      }
      setLoading(false);
    })();
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const payload = { user_id: user.id, ...profile } as Record<string, unknown>;

    const { error } = await supabase
      .from("business_profiles" as string)
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível guardar o perfil." });
    } else {
      toast({ title: "Perfil guardado ✅", description: "Os dados da empresa foram atualizados." });
    }
    setSaving(false);
  }

  const update = (field: keyof BusinessProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfile((p) => ({ ...p, [field]: e.target.value }));

  if (loading) {
    return <div className="h-48 animate-pulse bg-muted rounded-lg" />;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
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
              <Label>Nome Legal / Denominação Social</Label>
              <Input value={profile.legal_name} onChange={update("legal_name")} placeholder="Ex: Astrolábio Mágico Investimentos, Lda." />
            </div>
            <div className="space-y-2">
              <Label>Nome Comercial</Label>
              <Input value={profile.trade_name} onChange={update("trade_name")} placeholder="Ex: Nexus AI" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>NIF / NIPC</Label>
              <Input value={profile.nif} onChange={update("nif")} placeholder="123456789" maxLength={9} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>País</Label>
              <Input value={profile.country} onChange={update("country")} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Morada */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-5 w-5 text-primary" />
            Morada da Sede
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Linha de Endereço 1</Label>
            <Input value={profile.address_line1} onChange={update("address_line1")} placeholder="Rua, número, andar" />
          </div>
          <div className="space-y-2">
            <Label>Linha de Endereço 2</Label>
            <Input value={profile.address_line2} onChange={update("address_line2")} placeholder="Complemento (opcional)" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código Postal</Label>
              <Input value={profile.postal_code} onChange={update("postal_code")} placeholder="1000-001" />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={profile.city} onChange={update("city")} placeholder="Lisboa" />
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

      {/* Compliance */}
      <Card className="glass border-amber-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-amber-500" />
            Links de Conformidade
          </CardTitle>
          <CardDescription>URLs obrigatórias para cumprimento legal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Livro de Reclamações Online</Label>
            <Input value={profile.complaints_book_url} onChange={update("complaints_book_url")} placeholder="https://www.livroreclamacoes.pt/..." />
          </div>
          <div className="space-y-2">
            <Label>Diário da República (DRE)</Label>
            <Input value={profile.dre_url} onChange={update("dre_url")} placeholder="https://dre.pt/..." />
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
