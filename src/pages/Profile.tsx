import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "@/hooks/use-toast";
import { User, Camera, Save, Loader2, Building2, Mail, Lock, CreditCard, ArrowRight, AlertCircle } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const { profile, loading, refetch } = useProfile();
  const { hasSubscription } = useSubscription();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-billing-portal");
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("URL não recebido");
      }
    } catch (err: any) {
      toast({ title: "Erro ao abrir portal", description: err?.message || "Tenta novamente.", variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      setFullName((prev) => prev || profile.full_name || "");
      setCompanyName((prev) => prev || profile.company_name || "");
      setAvatarUrl((prev) => prev || profile.avatar_url);
    }
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erro ao carregar imagem", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
    const publicUrl = urlData.publicUrl + "?t=" + Date.now();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl, contact_email: user.email })
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("profiles")
        .insert({ user_id: user.id, avatar_url: publicUrl, contact_email: user.email });
    }

    setAvatarUrl(publicUrl);
    setUploading(false);
    refetch();
    toast({ title: "Avatar atualizado!" });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const payload = {
      full_name: fullName || null,
      company_name: companyName || null,
      contact_email: user.email,
    };

    const { error } = existing
      ? await supabase.from("profiles").update(payload).eq("user_id", user.id)
      : await supabase.from("profiles").insert({ user_id: user.id, ...payload });

    setSaving(false);

    if (error) {
      toast({ title: "Erro ao guardar", description: error.message, variant: "destructive" });
    } else {
      await refetch();
      toast({
        title: "Perfil guardado!",
        description: "Próximo passo: preenche os dados da empresa para ativar o teu dashboard.",
      });
      // Guide user to the next mandatory step
      setTimeout(() => navigate("/settings"), 800);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <User className="h-8 w-8 text-primary" />
          O Meu Perfil
        </h1>
        <p className="text-muted-foreground mt-1">
          Gere a tua informação pessoal e preferências
        </p>
      </div>

      {/* Avatar Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fotografia de Perfil</CardTitle>
          <CardDescription>Clica na imagem para alterar o teu avatar</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            disabled={uploading}
          >
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border group-hover:border-primary transition-colors">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploading ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </div>
          </button>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {fullName || "Sem nome definido"}
            </p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground">
              Formatos suportados: JPG, PNG. Máx 5MB.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações Pessoais</CardTitle>
          <CardDescription>Estes dados são usados no dashboard e nos relatórios</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Nome Completo
            </Label>
            <Input
              id="fullName"
              placeholder="O teu nome completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName" className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Nome da Empresa
            </Label>
            <Input
              id="companyName"
              placeholder="Nome que aparece nos relatórios"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email
              <Lock className="h-3 w-3 text-muted-foreground" />
            </Label>
            <Input
              id="email"
              value={user?.email ?? ""}
              disabled
              className="bg-muted/50 cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              O email não pode ser alterado por segurança.
            </p>
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar Alterações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Billing Portal */}
      {hasSubscription && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Faturação & Assinatura</CardTitle>
            <CardDescription>Gere os teus pagamentos, faturas e plano diretamente no Stripe</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openBillingPortal} disabled={portalLoading} variant="outline" className="gap-2">
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Gerir Faturas e Assinatura
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
