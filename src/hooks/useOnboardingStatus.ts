import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OnboardingStatus {
  socialConnected: boolean;
  whatsappConnected: boolean;
  firstCampaignLaunched: boolean;
  loading: boolean;
  progress: number;
  refetch: () => void;
}

export function useOnboardingStatus(): OnboardingStatus {
  const { user } = useAuth();
  const [socialConnected, setSocialConnected] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [firstCampaignLaunched, setFirstCampaignLaunched] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchStatus() {
    if (!user) { setLoading(false); return; }

    const [metaConnRes, whatsappRes, campaignRes] = await Promise.all([
      supabase.from("meta_connections").select("id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle(),
      supabase.from("whatsapp_accounts").select("id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle(),
      supabase.from("ads_campaigns").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
    ]);

    setSocialConnected(!!metaConnRes.data);
    setWhatsappConnected(!!whatsappRes.data);
    setFirstCampaignLaunched(!!campaignRes.data);
    setLoading(false);
  }

  useEffect(() => { fetchStatus(); }, [user]);

  const completed = [socialConnected, whatsappConnected, firstCampaignLaunched].filter(Boolean).length;
  const progress = Math.round((completed / 3) * 100);

  return { socialConnected, whatsappConnected, firstCampaignLaunched, loading, progress, refetch: fetchStatus };
}
