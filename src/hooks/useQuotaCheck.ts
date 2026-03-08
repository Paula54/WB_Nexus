import { useCallback } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type QuotaResource = "concierge" | "blog" | "perf_scan" | "whatsapp_ai";

interface QuotaData {
  concierge_used: number;
  concierge_limit: number;
  blog_used: number;
  blog_limit: number;
  perf_scan_used: number;
  perf_scan_limit: number;
  whatsapp_ai_used: number;
  whatsapp_ai_limit: number;
  plan_name: string;
  usage_reset_at: string;
}

const RESOURCE_LABELS: Record<QuotaResource, string> = {
  concierge: "Concierge IA",
  blog: "Posts de Blog",
  perf_scan: "Scans de Performance",
  whatsapp_ai: "WhatsApp IA",
};

export function useQuotaCheck() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quota, isLoading } = useQuery({
    queryKey: ["quota", user?.id],
    queryFn: async (): Promise<QuotaData | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "concierge_used, concierge_limit, blog_used, blog_limit, perf_scan_used, perf_scan_limit, whatsapp_ai_used, whatsapp_ai_limit, plan_type, usage_reset_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as QuotaData | null;
    },
    enabled: !!user,
  });

  const canUse = useCallback(
    (resource: QuotaResource): boolean => {
      if (!quota) return false;
      const used = quota[`${resource}_used`] as number;
      const limit = quota[`${resource}_limit`] as number;
      return used < limit;
    },
    [quota]
  );

  const checkAndIncrement = useCallback(
    async (resource: QuotaResource): Promise<boolean> => {
      if (!user || !quota) return false;
      const used = quota[`${resource}_used`] as number;
      const limit = quota[`${resource}_limit`] as number;

      if (used >= limit) {
        toast({
          title: "Limite atingido",
          description: `Atingiste o limite mensal de ${RESOURCE_LABELS[resource]} (${limit}). Faz upgrade do teu plano para continuar.`,
          variant: "destructive",
        });
        return false;
      }

      const { error } = await supabase
        .from("subscriptions")
        .update({ [`${resource}_used`]: used + 1 })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Quota increment error:", error);
        return false;
      }

      queryClient.invalidateQueries({ queryKey: ["quota", user.id] });
      return true;
    },
    [user, quota, toast, queryClient]
  );

  return { quota, isLoading, canUse, checkAndIncrement };
}
