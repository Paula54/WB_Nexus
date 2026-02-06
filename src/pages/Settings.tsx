import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Palette, User, Save, ChevronDown, ChevronUp, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  });
  const [whatsappNumber, setWhatsappNumber] = useState("");

  useEffect(() => {
    fetchProfile();
    fetchWhatsAppAccount();
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

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      ...profile,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível guardar as definições.",
      });
    } else {
      toast({
        title: "Identidade guardada ✨",
        description: "A identidade da tua marca foi atualizada.",
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

      {/* Advanced / Technical Settings - Hidden by default */}
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