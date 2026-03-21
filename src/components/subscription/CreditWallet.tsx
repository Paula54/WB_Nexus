import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, Fuel, FileText, Mail, Megaphone, AlertTriangle, Share2, Bot } from "lucide-react";
import { useUsageCredits, CREDIT_COSTS } from "@/hooks/useUsageCredits";

const CREDIT_DISPLAY = [
  { key: "blog", label: "Blog Post (IA)", cost: CREDIT_COSTS.blog, icon: FileText },
  { key: "newsletter", label: "Newsletter", cost: CREDIT_COSTS.newsletter, icon: Mail },
  { key: "ads_optimization", label: "Otimização Ads", cost: CREDIT_COSTS.ads_optimization, icon: Megaphone },
  { key: "social_post", label: "Post Social Media", cost: CREDIT_COSTS.social_post, icon: Share2 },
  { key: "concierge", label: "Query Concierge", cost: CREDIT_COSTS.concierge, icon: Bot },
];

export function CreditWallet() {
  const { credits, isLoading, remaining } = useUsageCredits();

  const isLow = remaining < 20;
  const pct = credits ? Math.min((credits.used_credits / credits.total_credits) * 100, 100) : 0;

  return (
    <Card className="glass border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Carteira AI Fuel
          </CardTitle>
          {credits && (
            <Badge variant="secondary" className="text-xs">
              {credits.plan_name}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-display font-bold text-foreground">
              {isLoading ? "—" : remaining}
            </p>
            <p className="text-xs text-muted-foreground">
              créditos disponíveis de {credits?.total_credits ?? "—"}
            </p>
          </div>
          <Fuel className="h-8 w-8 text-primary/40" />
        </div>

        {/* Progress bar */}
        {credits && (
          <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {isLow && !isLoading && (
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
            {CREDIT_DISPLAY.map((item) => (
              <div key={item.key} className="flex items-center justify-between text-xs">
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
