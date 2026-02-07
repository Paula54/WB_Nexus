import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Palette, User, Save, ChevronDown, ChevronUp, Settings as SettingsIcon, Store, Globe, BarChart3, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import GoogleAdsConnect from "@/components/settings/GoogleAdsConnect";

const SECTOR_OPTIONS = [
  { value: "cafetaria", label: "☕ Cafetaria / Pastelaria" },
  { value: "restaurante", label: "🍽️ Restaurante" },
  { value: "imobiliaria", label: "🏠 Imobiliária" },
  { value: "advocacia", label: "⚖️ Advocacia / Jurídico" },
  { value: "salao_beleza", label: "💅 Salão de Beleza / Estética" },
  { value: "fitness", label: "💪 Fitness / Ginásio" },
  { value: "loja_roupa", label: "👗 Loja de Roupa / Moda" },
  { value: "clinica", label: "🏥 Clínica / Saúde" },
];

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    company_name: "",
    contact_email: "",
    ai_custom_instructions: "",
    business_sector: "",
  });
  const [projectDomain, setProjectDomain] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState("");

  useEffect(() => {
    fetchProfile();
    fetchWhatsAppAccount();
    fetchProjectDomain();
  }, [user]);

  async function fetchProfile() {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
    } else if (data) {
      setProfile({
        full_name: data.full_name || "",
        company_name: data.company_name || "",
        contact_email: data.contact_email || "",
        ai_custom_instructions: data.ai_custom_instructions || "",
        business_sector: (data as Record<string, unknown>).business_sector as string || "",
      });
    }
    setLoading(false);
  }

  async function fetchWhatsAppAccount() {
    if (!user) return;

    const { data, error } = await supabase
      .from("whatsapp_accounts")
      .select("twilio_phone_number")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      setWhatsappNumber(data.twilio_phone_number);
    }
  }

  async function fetchProjectDomain() {
    if (!user) return;

    const { data, error } = await supabase
      .from("projects")
      .select("id, domain, google_analytics_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const d = data as Record<string, unknown>;
      setProjectId(data.id);
      setProjectDomain((d.domain as string) || "");
      setGoogleAnalyticsId((d.google_analytics_id as string) || "");
    }
  }

  async function saveProjectDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    const projectPayload = {
      domain: projectDomain || null,
      google_analytics_id: googleAnalyticsId || null,
    } as Record<string, unknown>;

    if (projectId) {
      const { error } = await supabase
        .from("projects")
        .update(projectPayload)
        .eq("id", projectId);

      if (error) {
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível guardar as configurações." });
      } else {
        toast({ title: "Configurações guardadas 🌐", description: "Domínio e Analytics atualizados com sucesso." });
      }
    } else {
      const { error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: profile.company_name || "Meu Projeto",
          ...projectPayload,
        } as Record<string, unknown>);

      if (error) {
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível criar o projeto." });
      } else {
        toast({ title: "Configurações guardadas 🌐", description: "Domínio e Analytics configurados." });
        fetchProjectDomain();
      }
    }

    setSaving(false);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      full_name: profile.full_name,
      company_name: profile.company_name,
      contact_email: profile.contact_email,
      ai_custom_instructions: profile.ai_custom_instructions,
      business_sector: profile.business_sector || null,
    } as Record<string, unknown>);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível guardar as definições.",
      });
    } else {
      toast({
        title: "Identidade guardada ✨",
        description: profile.business_sector
          ? `A IA está agora especializada no setor "${SECTOR_OPTIONS.find(s => s.value === profile.business_sector)?.label || profile.business_sector}".`
          : "A identidade da tua marca foi atualizada.",
      });
    }

    setSaving(false);
  }

  async function saveWhatsAppNumber(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !whatsappNumber) return;

    setSaving(true);

    const { error } = await supabase.from("whatsapp_accounts").upsert({
      user_id: user.id,
      twilio_phone_number: whatsappNumber,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível guardar o número.",
      });
    } else {
      toast({
        title: "Número guardado",
        description: "O número WhatsApp foi atualizado.",
      });
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="glass">
              <CardContent className="p-6 h-48 animate-pulse" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Palette className="h-8 w-8 text-primary" />
          Identidade da Marca
        </h1>
        <p className="text-muted-foreground mt-1">
          Define quem é o teu negócio e como a IA comunica por ti
        </p>
      </div>

      {/* Sector Selector - Prominent */}
      <Card className="glass border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Setor do Negócio
          </CardTitle>
          <CardDescription>
            Escolhe o teu setor para que a IA gere conteúdo especializado e estratégias adaptadas ao teu mercado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={profile.business_sector}
            onValueChange={(value) => setProfile({ ...profile, business_sector: value })}
          >
            <SelectTrigger className="w-full md:w-96">
              <SelectValue placeholder="Seleciona o setor do teu negócio..." />
            </SelectTrigger>
            <SelectContent>
              {SECTOR_OPTIONS.map((sector) => (
                <SelectItem key={sector.value} value={sector.value}>
                  {sector.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {profile.business_sector && (
            <p className="text-xs text-primary mt-2">
              ✨ A IA está especializada para o setor de{" "}
              <strong>{SECTOR_OPTIONS.find(s => s.value === profile.business_sector)?.label}</strong>.
              Todo o conteúdo gerado será adaptado automaticamente.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Domain & Analytics Configuration */}
      <Card className="glass border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Domínio & Rastreamento
          </CardTitle>
          <CardDescription>
            Configura o domínio do teu site e o Google Analytics para monitorização automática
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProjectDomain} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">URL do site</Label>
              <Input
                id="domain"
                value={projectDomain}
                onChange={(e) => setProjectDomain(e.target.value)}
                placeholder="https://omeunegocio.pt"
              />
              {projectDomain && (
                <p className="text-xs text-primary">
                  🌐 A auditoria SEO está ativa para <strong>{projectDomain}</strong>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ga_id" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                ID de Acompanhamento Google Analytics
              </Label>
              <Input
                id="ga_id"
                value={googleAnalyticsId}
                onChange={(e) => setGoogleAnalyticsId(e.target.value)}
                placeholder="G-XXXXXXXXXX"
              />
              <p className="text-xs text-muted-foreground">
                Insere o teu Measurement ID (G-XXXXX) e o script será injetado automaticamente em todas as páginas.
              </p>
              {googleAnalyticsId && /^G-[A-Z0-9]+$/i.test(googleAnalyticsId) && (
                <p className="text-xs text-primary">
                  📊 Google Analytics ativo — <strong>{googleAnalyticsId}</strong> está a rastrear o teu site.
                </p>
              )}
            </div>

            <Button type="submit" disabled={saving} size="default">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "A guardar..." : "Guardar Configurações"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Brand Identity */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            O Teu Negócio
          </CardTitle>
          <CardDescription>Estas informações personalizam toda a experiência da IA</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">O Teu Nome</Label>
                <Input
                  id="full_name"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Como queres ser tratado pela IA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Nome do Negócio</Label>
                <Input
                  id="company_name"
                  value={profile.company_name}
                  onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                  placeholder="Ex: Cafetaria do Porto"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Email de Contacto</Label>
              <Input
                id="contact_email"
                type="email"
                value={profile.contact_email}
                onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })}
                placeholder="Para onde enviar notificações importantes"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai_instructions">Personalidade da IA</Label>
              <textarea
                id="ai_instructions"
                value={profile.ai_custom_instructions}
                onChange={(e) => setProfile({ ...profile, ai_custom_instructions: e.target.value })}
                className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-sm"
                placeholder="Descreve o tom que a IA deve usar ao falar com os teus clientes. Ex: 'Tom acolhedor e familiar, referir sempre o menu do dia.'"
              />
              <p className="text-xs text-muted-foreground">
                Isto influencia como o Concierge e o WhatsApp respondem em teu nome.
              </p>
            </div>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "A guardar..." : "Guardar Identidade"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Integrations */}
      <div className="space-y-4">
        <h2 className="text-xl font-display font-semibold text-foreground flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          Integrações
        </h2>
        <GoogleAdsConnect />
      </div>

      {/* Advanced / Technical Settings */}
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            <span className="text-sm font-medium">Configurações Avançadas</span>
          </div>
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        <div
          className={cn(
            "transition-all duration-300 overflow-hidden",
            showAdvanced ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="p-4 pt-0">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-sm">WhatsApp — Número de Integração</CardTitle>
                <CardDescription className="text-xs">
                  Apenas necessário se tiveres uma integração técnica configurada
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveWhatsAppNumber} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp_number" className="text-xs">Número WhatsApp</Label>
                    <Input
                      id="whatsapp_number"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="+351XXXXXXXXX"
                    />
                  </div>
                  <Button type="submit" disabled={saving} size="sm" variant="secondary">
                    <Save className="h-3 w-3 mr-2" />
                    {saving ? "A guardar..." : "Guardar"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
