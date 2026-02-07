import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Sem sessão ativa");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            planType,
            projectId,
            successUrl: `${window.location.origin}/strategy?checkout=success`,
            cancelUrl: `${window.location.origin}/strategy?checkout=cancel`,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar sessão de pagamento");
      }

      if (data.url) {
        window.location.href = data.url;
      }
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
