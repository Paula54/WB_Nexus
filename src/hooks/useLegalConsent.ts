import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useLegalConsent() {
  const { user } = useAuth();
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  async function checkConsent() {
    if (!user) {
      setLoading(false);
      setHasConsented(null);
      return;
    }

    const { data } = await supabase
      .from("legal_consents" as any)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    setHasConsented(!!data);
    setLoading(false);
  }

  useEffect(() => {
    checkConsent();
  }, [user]);

  async function acceptConsent(planSelected = "START") {
    if (!user) return;

    // Try to get IP
    let ip = "unknown";
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const json = await res.json();
      ip = json.ip;
    } catch {
      // ignore
    }

    const { error } = await supabase.from("legal_consents" as any).insert({
      user_id: user.id,
      ip_address: ip,
      plan_selected: planSelected,
      accepted_at: new Date().toISOString(),
    } as any);

    if (!error) {
      setHasConsented(true);
    }

    return { error };
  }

  return { hasConsented, loading, acceptConsent, recheckConsent: checkConsent };
}
