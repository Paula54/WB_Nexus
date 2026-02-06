import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProjectData {
  id: string;
  name: string;
  domain: string | null;
  google_analytics_id: string | null;
  selected_plan: string | null;
  trial_expires_at: string | null;
}

export interface ProfileData {
  company_name: string | null;
  business_sector: string | null;
  full_name: string | null;
}

export function useProjectData() {
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      const [projectRes, profileRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, domain, selected_plan, trial_expires_at, google_analytics_id")
          .eq("user_id", user!.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("company_name, business_sector, full_name")
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);

      if (projectRes.data) {
        const d = projectRes.data as Record<string, unknown>;
        setProject({
          id: d.id as string,
          name: d.name as string,
          domain: (d.domain as string) || null,
          google_analytics_id: (d.google_analytics_id as string) || null,
          selected_plan: (d.selected_plan as string) || null,
          trial_expires_at: (d.trial_expires_at as string) || null,
        });
      }

      if (profileRes.data) {
        setProfile({
          company_name: profileRes.data.company_name,
          business_sector: profileRes.data.business_sector,
          full_name: profileRes.data.full_name,
        });
      }

      setLoading(false);
    }

    fetchData();
  }, [user]);

  return { project, profile, loading };
}
