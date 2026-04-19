import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";

export interface OnboardingStatus {
  dnaConfigured: boolean;
  socialConnected: boolean;
  whatsappConnected: boolean;
  firstCampaignLaunched: boolean;
  loading: boolean;
  progress: number;
  refetch: () => void;
}

export function useOnboardingStatus(): OnboardingStatus {
  const { user } = useAuth();
  const [dnaConfigured, setDnaConfigured] = useState(false);
  const [socialConnected, setSocialConnected] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [firstCampaignLaunched, setFirstCampaignLaunched] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchStatus() {
    if (!user) { setLoading(false); return; }

    // DNA agora vive na tabela `projects` (business_name/business_sector/description)
    const { data: project } = await supabase
      .from("projects")
      .select("id, business_name, business_sector, description, legal_name, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const p = project as Record<string, unknown> | null;
    const name = (p?.business_name as string) || (p?.legal_name as string) || (p?.name as string) || "";
    const sector = (p?.business_sector as string) || "";
    const description = (p?.description as string) || "";
    const hasDna = !!(name.trim() && (sector.trim() || description.trim()));

    let hasFbOrIg = false;
    let hasWhatsapp = false;

    if (project) {
      const { data: creds } = await supabase
        .from("project_credentials" as any)
        .select("facebook_page_id, instagram_business_id, whatsapp_business_id")
        .eq("project_id", project.id)
        .maybeSingle();
      const raw = creds as Record<string, unknown> | null;
      hasFbOrIg = !!(raw?.facebook_page_id || raw?.instagram_business_id);
      hasWhatsapp = !!raw?.whatsapp_business_id;
    }

    // Check campaigns
    const { data: campaign } = await supabase
      .from("ads_campaigns")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    setDnaConfigured(hasDna);
    setSocialConnected(hasFbOrIg);
    setWhatsappConnected(hasWhatsapp);
    setFirstCampaignLaunched(!!campaign);
    setLoading(false);
  }

  useEffect(() => { fetchStatus(); }, [user]);

  const completed = [dnaConfigured, socialConnected, whatsappConnected, firstCampaignLaunched].filter(Boolean).length;
  const progress = Math.round((completed / 4) * 100);

  return { dnaConfigured, socialConnected, whatsappConnected, firstCampaignLaunched, loading, progress, refetch: fetchStatus };
}
