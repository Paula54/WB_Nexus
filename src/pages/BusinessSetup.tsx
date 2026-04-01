import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, CreditCard, CheckCircle2, Loader2 } from "lucide-react";

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

export default function BusinessSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { startCheckout, loading: checkoutLoading } = useStripeCheckout();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState<BusinessForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [planType, setPlanType] = useState<string>("START");
  const [projectId, setProjectId] = useState<string | null>(null);

  // Load existing data and project
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // Load business profile if exists
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
        // If all required fields already filled, mark as saved
        if (bp.nif && bp.legal_name && bp.address_line1 && bp.city && bp.postal_code) {
          setSaved(true);
        }
      }

      // Load plan from lead or project
      const leadId = searchParams.get("lead_id");
      if (leadId) {
        const { data: lead } = await supabase
          .from("leads")
          .select("custom_fields")
          .eq("id", leadId)
          .maybeSingle();
        const leadPlan = (lead?.custom_fields as Record<string, string>)?.plan;
        if (leadPlan) setPlanType(leadPlan);
      }

      // Get project
      const { data: project } = await supabase
        .from("projects")
        .select("id, selected_plan")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (project) {
        setProjectId(project.id);
        if (project.selected_plan) setPlanType(project.selected_plan);
      }
    };

    load();
  }, [user, searchParams]);

  const handleChange = (field: keyof BusinessForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
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
        const { error } = await supabase
          .from("business_profiles")
          .update(payload)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("business_profiles")
          .insert(payload);
        if (error) throw error;
      }

      setSaved(true);
      toast({ title: "Dados guardados", description: "Dados de faturação atualizados com sucesso." });
    } catch (err) {
      console.error("[BusinessSetup] Save error:", err);
      toast({ title: "Erro ao guardar", description: "Verifica os dados e tenta novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCheckout = () => {
    if (!projectId) {
      toast({ title: "Sem projeto", description: "Nenhum projeto encontrado. Contacta o suporte.", variant: "destructive" });
      return;
    }
    startCheckout(planType as "START" | "GROWTH" | "NEXUS_OS", projectId);
  };

  const planLabels: Record<string, string> = {
    START: "Nexus Start — 49€/mês",
    GROWTH: "Nexus Growth — 149€/mês",
    NEXUS_OS: "Nexus OS — 299€/mês",
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-display font-bold text-foreground">
            Configuração do Negócio
          </h1>
          <p className="text-muted-foreground">
            Preenche os dados de faturação para ativar o teu plano.
          </p>
        </div>

        {/* Plan badge */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm">
            <CheckCircle2 className="h-4 w-4" />
            {planLabels[planType] || planType}
          </span>
        </div>

        {/* Billing form */}
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
              <Input
                id="legal_name"
                value={form.legal_name}
                onChange={(e) => handleChange("legal_name", e.target.value)}
                placeholder="Ex: Empresa Lda."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nif">NIF * (9 dígitos)</Label>
              <Input
                id="nif"
                value={form.nif}
                onChange={(e) => handleChange("nif", e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="123456789"
                maxLength={9}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Morada *</Label>
              <Input
                id="address"
                value={form.address_line1}
                onChange={(e) => handleChange("address_line1", e.target.value)}
                placeholder="Rua / Avenida"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade *</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  placeholder="Lisboa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal">Código Postal *</Label>
                <Input
                  id="postal"
                  value={form.postal_code}
                  onChange={(e) => handleChange("postal_code", e.target.value)}
                  placeholder="1000-000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+351 900 000 000"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={!isFormValid || saving}
              className="w-full"
              variant="outline"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {saved ? "✓ Dados Guardados" : "Guardar Dados de Faturação"}
            </Button>
          </CardContent>
        </Card>

        {/* Stripe checkout — only active after saving */}
        <Button
          onClick={handleCheckout}
          disabled={!saved || checkoutLoading || !projectId}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {checkoutLoading ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <CreditCard className="h-5 w-5 mr-2" />
          )}
          Finalizar Pagamento
        </Button>

        {!saved && (
          <p className="text-center text-xs text-muted-foreground">
            Preenche e guarda os dados de faturação para desbloquear o pagamento.
          </p>
        )}
      </div>
    </div>
  );
}
