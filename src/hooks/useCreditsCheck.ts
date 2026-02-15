import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface CreditStatus {
  canProceed: boolean;
  reason?: string;
  walletBalance: number;
  creditsRemaining: number;
  imagesRemaining: number;
}

export function useCreditsCheck() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showRechargeModal, setShowRechargeModal] = useState(false);

  const checkCredits = useCallback(
    async (type: "text" | "image" | "wallet", cost = 0): Promise<CreditStatus> => {
      if (!user) return { canProceed: false, reason: "Não autenticado", walletBalance: 0, creditsRemaining: 0, imagesRemaining: 0 };

      const [profileRes, txRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("ai_credits_used, ai_credits_limit, ai_images_used, ai_images_limit")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("wallet_transactions").select("amount").eq("user_id", user.id),
      ]);

      const p = profileRes.data as Record<string, number> | null;
      const walletBalance = (txRes.data || []).reduce((s: number, t: { amount: number }) => s + t.amount, 0);
      const creditsRemaining = (p?.ai_credits_limit ?? 50000) - (p?.ai_credits_used ?? 0);
      const imagesRemaining = (p?.ai_images_limit ?? 100) - (p?.ai_images_used ?? 0);

      let canProceed = true;
      let reason: string | undefined;

      if (type === "text" && creditsRemaining <= 0) {
        canProceed = false;
        reason = "Limite de texto IA atingido";
      } else if (type === "image" && imagesRemaining <= 0) {
        canProceed = false;
        reason = "Limite de imagens atingido";
      } else if (type === "wallet" && walletBalance < cost) {
        canProceed = false;
        reason = "Saldo insuficiente na Wallet";
      }

      if (!canProceed) {
        setShowRechargeModal(true);
        toast({
          title: "Limite atingido",
          description: `${reason}. Recarrega a tua Wallet para continuar.`,
          variant: "destructive",
        });
      }

      return { canProceed, reason, walletBalance, creditsRemaining, imagesRemaining };
    },
    [user, toast]
  );

  return { checkCredits, showRechargeModal, setShowRechargeModal };
}
