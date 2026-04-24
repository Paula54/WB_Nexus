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
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("[useProfile] fetch error:", error.message);
      setLoading(false);
      return;
    }

    const latestProfile = data?.[0] ?? null;

    // Only overwrite state with non-null data to avoid race conditions
    // wiping out freshly-saved values before the row is visible to the read replica.
    if (latestProfile) {
      setProfile(latestProfile);
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
