import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";

export interface ProjectData {
  id: string;
  name: string;
  domain: string | null;
  google_analytics_id: string | null;
}

export interface ProfileData {
  company_name: string | null;
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
          .select("id, name, domain, google_analytics_id")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("company_name, full_name")
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);

      if (projectRes.data) {
        const d = projectRes.data as Record<string, unknown>;
        setProject({
          id: d.id as string,
          name: d.name as string,
          domain: (d.domain as string) || null,
        });
      }

      if (profileRes.data) {
        setProfile({
          company_name: profileRes.data.company_name,
          full_name: profileRes.data.full_name,
        });
      }

      setLoading(false);
    }

    fetchData();
  }, [user]);

  return { project, profile, loading };
}
