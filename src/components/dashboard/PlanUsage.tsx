import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Image, Wallet } from "lucide-react";

interface UsageData {
  ai_credits_used: number;
  ai_credits_limit: number;
  ai_images_used: number;
  ai_images_limit: number;
  walletBalance: number;
}

export function PlanUsage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    if (!user) return;
    async function fetch() {
      const [profileRes, txRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("ai_credits_used, ai_credits_limit, ai_images_used, ai_images_limit")
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase.from("wallet_transactions").select("amount").eq("user_id", user!.id),
      ]);
      const p = profileRes.data as Record<string, number> | null;
      const balance = (txRes.data || []).reduce((s: number, t: { amount: number }) => s + t.amount, 0);
      setUsage({
        ai_credits_used: p?.ai_credits_used ?? 0,
        ai_credits_limit: p?.ai_credits_limit ?? 50000,
        ai_images_used: p?.ai_images_used ?? 0,
        ai_images_limit: p?.ai_images_limit ?? 100,
        walletBalance: balance,
      });
    }
    fetch();
  }, [user]);

  if (!usage) return null;

  const items = [
    {
      label: "Texto IA (Palavras)",
      used: usage.ai_credits_used,
      limit: usage.ai_credits_limit,
      icon: Sparkles,
      color: "bg-primary",
      format: (v: number) => v.toLocaleString("pt-PT"),
    },
    {
      label: "Imagens Geradas",
      used: usage.ai_images_used,
      limit: usage.ai_images_limit,
      icon: Image,
      color: "bg-neon-purple",
      format: (v: number) => String(v),
    },
  ];

  const walletPercent = Math.min((usage.walletBalance / 100) * 100, 100);

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Uso do Plano</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => {
          const pct = item.limit > 0 ? Math.min((item.used / item.limit) * 100, 100) : 0;
          const isNearLimit = pct >= 80;
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </span>
                <span className={`text-xs font-medium ${isNearLimit ? "text-destructive" : "text-foreground"}`}>
                  {item.format(item.used)} / {item.format(item.limit)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isNearLimit ? "bg-destructive" : item.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* Wallet */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              Saldo Wallet
            </span>
            <span className="text-xs font-medium text-foreground">
              {usage.walletBalance.toFixed(2)} €
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-neon-green transition-all"
              style={{ width: `${walletPercent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
