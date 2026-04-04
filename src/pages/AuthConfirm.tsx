import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<"processing" | "error">("processing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const processConfirmation = async () => {
      try {
        // 1. Handle Supabase auth confirmation (token from email link)
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type") as "signup" | "recovery" | "email" | null;
        const leadId = searchParams.get("lead_id");

        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type === "signup" ? "signup" : type === "recovery" ? "recovery" : "email",
          });
          if (error) {
            setStatus("error");
            setErrorMsg(error.message);
            return;
          }
        }

        // Wait for session to be available
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUser = sessionData?.session?.user;

        if (!currentUser) {
          // If no session yet, wait a moment and retry
          await new Promise((r) => setTimeout(r, 1500));
          const { data: retry } = await supabase.auth.getSession();
          if (!retry?.session?.user) {
            setStatus("error");
            setErrorMsg("Sessão não encontrada. Tenta fazer login.");
            return;
          }
          await populateProfile(retry.session.user.id, leadId);
        } else {
          await populateProfile(currentUser.id, leadId);
        }

        // 2. Redirect to business setup with lead_id context
        navigate(`/setup${leadId ? `?lead_id=${leadId}` : ""}`, { replace: true });
      } catch (err) {
        console.error("[AuthConfirm] Error:", err);
        setStatus("error");
        setErrorMsg("Ocorreu um erro inesperado.");
      }
    };

    processConfirmation();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {status === "processing" ? (
        <div className="text-center space-y-4">
          <div className="animate-pulse-glow w-16 h-16 rounded-full bg-primary/20 mx-auto" />
          <p className="text-muted-foreground">A confirmar a tua conta...</p>
        </div>
      ) : (
        <div className="text-center space-y-4 max-w-md px-4">
          <p className="text-destructive font-semibold">Erro na confirmação</p>
          <p className="text-muted-foreground">{errorMsg}</p>
          <a href="/auth" className="text-primary underline">Ir para Login</a>
        </div>
      )}
    </div>
  );
}

async function populateProfile(userId: string, leadId: string | null) {
  // Check if profile already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return; // Profile already exists

  // If we have a lead_id, fetch lead data to populate the profile
  let leadData: { name?: string; email?: string; company?: string } = {};
  if (leadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("name, email, company")
      .eq("id", leadId)
      .maybeSingle();
    if (lead) leadData = lead;
  }

  await supabase.from("profiles").insert({
    user_id: userId,
    full_name: leadData.name || null,
    contact_email: leadData.email || null,
    company_name: leadData.company || null,
  });

  console.log("[AuthConfirm] Profile created from lead data for", userId);
}
