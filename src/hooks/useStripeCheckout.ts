import { useState } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { PlanType } from "@/types/nexus";

export function useStripeCheckout() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const startCheckout = async (planType: PlanType, projectId: string) => {
    if (!user) {
      toast({
        title: "Sessão expirada",
        description: "Faz login para continuar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const origin = window.location.origin.replace(/\/$/, "");
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          planType,
          projectId,
          successUrl: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/strategy?checkout=cancel`,
        },
      });

      if (error) {
        throw new Error(error.message || "Erro ao criar sessão de pagamento");
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("Sessão de pagamento inválida");
    } catch (error: unknown) {
      console.error("Checkout error:", error);
      toast({
        title: "Erro no checkout",
        description: error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return { startCheckout, loading };
}
