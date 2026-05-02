import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseCustom";
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

    const { data, error } = await supabase
      .from("legal_consents")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (error) console.error("[LegalConsent] Check error:", error);

    setHasConsented(!!data);
    setLoading(false);
  }

  useEffect(() => {
    checkConsent();
  }, [user]);

  async function acceptConsent(planSelected?: string | null) {
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

    const consentPayload: Record<string, any> = {
      user_id: user.id,
      ip_address: ip,
      accepted_at: new Date().toISOString(),
    };

    if (planSelected && planSelected.trim()) {
      consentPayload.plan_selected = planSelected;
    }

    console.log("[LegalConsent] Inserting consent for user:", user.id);
    
    // Verify we have a valid session before inserting
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      console.error("[LegalConsent] No active session found");
      return { error: { message: "Sessão não encontrada. Tenta recarregar a página." } };
    }
    
    // Check existing first to avoid relying on a unique constraint
    const { data: existing } = await supabase
      .from("legal_consents")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let error: any = null;
    let data: any = null;

    if (existing) {
      ({ error, data } = await supabase
        .from("legal_consents")
        .update(consentPayload)
        .eq("user_id", user.id)
        .select());
    } else {
      ({ error, data } = await supabase
        .from("legal_consents")
        .insert(consentPayload)
        .select());
    }

    console.log("[LegalConsent] Insert result:", { error, data });

    if (!error || error?.code === "23505") {
      setHasConsented(true);
      return { error: null };
    }

    return { error };
  }

  return { hasConsented, loading, acceptConsent, recheckConsent: checkConsent };
}
