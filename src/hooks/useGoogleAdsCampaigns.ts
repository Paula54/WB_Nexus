import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface GoogleCampaign {
  id: string;
  name: string;
  status: string;
  channel_type: string;
  budget_micros: string;
  impressions: string;
  clicks: string;
  cost_micros: string;
}

interface GoogleAdsResult {
  success?: boolean;
  total?: number;
  customer_id?: string;
  campaigns?: GoogleCampaign[];
  error?: string;
}

interface GoogleAdsAccount {
  google_ads_customer_id: string | null;
  is_active: boolean;
}

export function useGoogleAdsCampaigns() {
  const [campaigns, setCampaigns] = useState<GoogleCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [customerIdMissing, setCustomerIdMissing] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if Google Ads account is connected
  const checkConnection = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("google_ads_accounts")
      .select("google_ads_customer_id, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const account = data as GoogleAdsAccount | null;
    if (account) {
      setConnected(true);
      setCustomerId(account.google_ads_customer_id);
      setCustomerIdMissing(!account.google_ads_customer_id);
    } else {
      setConnected(false);
    }
  }, []);

  const fetchCampaigns = useCallback(async (showToast = false) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("list-google-campaigns", {
        method: "POST",
      });

      if (fnError) throw fnError;

      const result = data as GoogleAdsResult;

      if (result.success) {
        setCampaigns(result.campaigns || []);
        if (showToast) {
          toast({
            title: `${result.total} campanha(s) sincronizada(s) ✅`,
            description: `Customer ID: ${result.customer_id}`,
          });
        }
      } else {
        setError(result.error || "Erro desconhecido");
        if (showToast) {
          toast({
            variant: "destructive",
            title: "Erro ao sincronizar",
            description: result.error || "Erro desconhecido",
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha na sincronização";
      setError(message);
      if (showToast) {
        toast({ variant: "destructive", title: "Erro", description: message });
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  const syncNow = useCallback(() => {
    setSyncing(true);
    fetchCampaigns(true);
  }, [fetchCampaigns]);

  // Auto-fetch on mount if connected and customer ID is set
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (connected && !customerIdMissing) {
      fetchCampaigns(false);
    }
  }, [connected, customerIdMissing, fetchCampaigns]);

  // Computed KPIs
  const totalImpressions = campaigns.reduce((sum, c) => sum + (parseInt(c.impressions) || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (parseInt(c.clicks) || 0), 0);
  const totalCostMicros = campaigns.reduce((sum, c) => sum + (parseInt(c.cost_micros) || 0), 0);
  const totalSpend = totalCostMicros / 1_000_000;
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";
  const costPerLead = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : "0.00";

  return {
    campaigns,
    loading,
    syncing,
    connected,
    customerIdMissing,
    customerId,
    error,
    syncNow,
    totalImpressions,
    totalClicks,
    totalSpend,
    ctr,
    costPerLead,
  };
}
