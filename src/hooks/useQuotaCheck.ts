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
  plan_type: string;
  usage_reset_at: string;
}

interface RawQuotaData extends Omit<QuotaData, "plan_type"> {
  plan_type?: string | null;
  plan_name?: string | null;
}

function normalizePlanType(planType: string | null | undefined) {
  if (!planType) return null;

  const normalized = planType
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (["start", "nexus_start", "nexusstart", "lite"].includes(normalized)) {
    return "START";
  }

  if (["growth", "nexus_growth", "nexusgrowth", "business", "pro", "professional"].includes(normalized)) {
    return "GROWTH";
  }

  if (["nexus_os", "nexusos", "os", "elite"].includes(normalized)) {
    return "NEXUS_OS";
  }

  return null;
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
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      const raw = data as RawQuotaData | null;
      if (!raw) return null;

      return {
        concierge_used: raw.concierge_used,
        concierge_limit: raw.concierge_limit,
        blog_used: raw.blog_used,
        blog_limit: raw.blog_limit,
        perf_scan_used: raw.perf_scan_used,
        perf_scan_limit: raw.perf_scan_limit,
        whatsapp_ai_used: raw.whatsapp_ai_used,
        whatsapp_ai_limit: raw.whatsapp_ai_limit,
        plan_type: normalizePlanType(raw.plan_name ?? raw.plan_type) ?? raw.plan_name ?? raw.plan_type ?? "START",
        usage_reset_at: raw.usage_reset_at,
      };
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
