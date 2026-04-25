import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const html = (title: string, msg: string) => `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;"><div style="background:#fff;padding:48px 32px;border-radius:12px;max-width:480px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.08);"><h1 style="color:#1a1a2e;margin:0 0 16px;font-size:24px;">${title}</h1><p style="color:#6b7280;line-height:1.6;margin:0;">${msg}</p></div></body></html>`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(html("Link inválido", "Link de cancelamento inválido."), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Decode token: base64(user_id:email)
    let userId = "", email = "";
    try {
      const decoded = atob(token);
      [userId, email] = decoded.split("|");
    } catch {
      return new Response(html("Link inválido", "Link de cancelamento inválido."), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (!userId || !email) {
      return new Response(html("Link inválido", "Link de cancelamento inválido."), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await admin
      .from("subscribers")
      .update({ status: "unsubscribed" })
      .eq("user_id", userId)
      .eq("email", email);

    return new Response(
      html("Subscrição cancelada", `O email <strong>${email}</strong> foi removido da lista. Não voltará a receber comunicações.`),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (e) {
    console.error("[unsubscribe] error:", e);
    return new Response(html("Erro", "Ocorreu um erro. Tente novamente mais tarde."), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
