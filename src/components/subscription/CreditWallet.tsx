import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, Fuel, FileText, Mail, Megaphone, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseCustom";

const CREDIT_COSTS = [
  { label: "Blog Post (IA)", cost: 20, icon: FileText },
  { label: "Newsletter", cost: 10, icon: Mail },
  { label: "Otimização Ads", cost: 2, icon: Megaphone },
];

export function CreditWallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("wallet_transactions" as string)
        .select("amount, type")
        .eq("user_id", user.id);

      if (data) {
        const total = (data as any[]).reduce((sum, t) => {
          return t.type === "credit" || t.type === "topup" || t.type === "cashback"
            ? sum + Number(t.amount)
            : sum - Math.abs(Number(t.amount));
        }, 0);
        setBalance(total);
      }
      setLoading(false);
    })();
  }, [user]);

  const isLow = balance < 20;

  return (
    <Card className="glass border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Carteira AI Fuel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-display font-bold text-foreground">
              {loading ? "—" : `${balance.toFixed(0)}`}
            </p>
            <p className="text-xs text-muted-foreground">créditos disponíveis</p>
          </div>
          <Fuel className="h-8 w-8 text-primary/40" />
        </div>

        {isLow && !loading && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground">Limite Atingido</p>
              <p className="text-[11px] text-muted-foreground">
                Adquire um top-up de créditos para continuar a usar funcionalidades IA.
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-border/50 pt-3">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Tabela de consumo:</p>
          <div className="space-y-1.5">
            {CREDIT_COSTS.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {item.cost} créditos
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 text-xs">
            +50 créditos — 29€
          </Button>
          <Button size="sm" className="flex-1 text-xs">
            +200 créditos — 99€
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
