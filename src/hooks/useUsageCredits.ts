import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface UsageCredits {
  total_credits: number;
  used_credits: number;
  plan_name: string;
  last_reset: string;
}

const PLAN_CREDITS: Record<string, number> = {
  Start: 100,
  Growth: 300,
  OS: 1000,
};

export const CREDIT_COSTS: Record<string, number> = {
  blog: 20,
  newsletter: 10,
  ads_optimization: 2,
  concierge: 1,
  social_post: 5,
};

export function useUsageCredits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<UsageCredits | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("nx_usage_credits" as string)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const d = data as Record<string, unknown>;
      setCredits({
        total_credits: d.total_credits as number,
        used_credits: d.used_credits as number,
        plan_name: d.plan_name as string,
        last_reset: d.last_reset as string,
      });
    } else {
      // Auto-create a row for the user with default Start credits
      const { data: newRow } = await supabase
        .from("nx_usage_credits" as string)
        .insert({ user_id: user.id, total_credits: 100, used_credits: 0, plan_name: "Start" } as Record<string, unknown>)
        .select()
        .single();
      if (newRow) {
        const d = newRow as Record<string, unknown>;
        setCredits({
          total_credits: d.total_credits as number,
          used_credits: d.used_credits as number,
          plan_name: d.plan_name as string,
          last_reset: d.last_reset as string,
        });
      }
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const remaining = credits ? credits.total_credits - credits.used_credits : 0;

  const spendCredits = useCallback(async (action: string): Promise<boolean> => {
    if (!user || !credits) return false;

    const cost = CREDIT_COSTS[action] ?? 0;
    if (cost === 0) return true;

    const newUsed = credits.used_credits + cost;
    if (newUsed > credits.total_credits) {
      toast({
        variant: "destructive",
        title: "Créditos insuficientes",
        description: `Esta ação requer ${cost} créditos. Tens apenas ${credits.total_credits - credits.used_credits} disponíveis. Adquire um top-up.`,
      });
      return false;
    }

    const { error } = await supabase
      .from("nx_usage_credits" as string)
      .update({ used_credits: newUsed, updated_at: new Date().toISOString() } as Record<string, unknown>)
      .eq("user_id", user.id);

    if (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível descontar créditos." });
      return false;
    }

    setCredits((prev) => prev ? { ...prev, used_credits: newUsed } : prev);
    return true;
  }, [user, credits]);

  return { credits, isLoading, remaining, spendCredits, refetch: fetchCredits };
}
