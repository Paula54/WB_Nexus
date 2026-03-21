import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseCustom";
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

    // Check project columns for Meta IDs
    const { data: project } = await supabase
      .from("projects")
      .select("id, facebook_page_id, instagram_business_id, whatsapp_business_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const raw = project as Record<string, unknown> | null;
    const hasFbOrIg = !!(raw?.facebook_page_id || raw?.instagram_business_id);
    const hasWhatsapp = !!raw?.whatsapp_business_id;

    // Check campaigns
    const { data: campaign } = await supabase
      .from("ads_campaigns")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    setSocialConnected(hasFbOrIg);
    setWhatsappConnected(hasWhatsapp);
    setFirstCampaignLaunched(!!campaign);
    setLoading(false);
  }

  useEffect(() => { fetchStatus(); }, [user]);

  const completed = [socialConnected, whatsappConnected, firstCampaignLaunched].filter(Boolean).length;
  const progress = Math.round((completed / 3) * 100);

  return { socialConnected, whatsappConnected, firstCampaignLaunched, loading, progress, refetch: fetchStatus };
}
