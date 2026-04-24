import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";

export interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, company_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("[useProfile] fetch error:", error.message);
      setLoading(false);
      return;
    }

    // Only overwrite state with non-null data to avoid race conditions
    // wiping out freshly-saved values before the row is visible to the read replica.
    if (data) {
      setProfile(data);
    } else {
      setProfile((prev) => prev ?? null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, refetch: fetchProfile };
}
