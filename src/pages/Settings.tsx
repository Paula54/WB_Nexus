import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, User, MessageCircle, Save } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        title: "Definições guardadas",
        description: "As suas definições foram atualizadas.",
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
        <h1 className="text-3xl font-display font-bold text-foreground">Definições</h1>
        <p className="text-muted-foreground mt-1">
          Configure a sua conta e integrações
        </p>
      </div>

      {/* Profile Settings */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Perfil
          </CardTitle>
          <CardDescription>Informações da sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo</Label>
                <Input
                  id="full_name"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Nome da Empresa</Label>
                <Input
                  id="company_name"
                  value={profile.company_name}
                  onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
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
                placeholder="Usado como fallback quando o limite de WhatsApp é atingido"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai_instructions">Instruções Personalizadas para IA</Label>
              <textarea
                id="ai_instructions"
                value={profile.ai_custom_instructions}
                onChange={(e) => setProfile({ ...profile, ai_custom_instructions: e.target.value })}
                className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-sm"
                placeholder="Instruções para personalizar as respostas da IA (tom, contexto, etc.)"
              />
            </div>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "A guardar..." : "Guardar Perfil"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* WhatsApp Settings */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            WhatsApp
          </CardTitle>
          <CardDescription>Configure o número Twilio para WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveWhatsAppNumber} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">Número Twilio WhatsApp</Label>
              <Input
                id="whatsapp_number"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+351XXXXXXXXX"
              />
              <p className="text-xs text-muted-foreground">
                O número registado na sua conta Twilio para receber mensagens WhatsApp.
              </p>
            </div>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "A guardar..." : "Guardar Número"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
