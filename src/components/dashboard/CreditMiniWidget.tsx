import { Fuel } from "lucide-react";
import { useUsageCredits } from "@/hooks/useUsageCredits";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

export function CreditMiniWidget() {
  const { credits, isLoading, remaining } = useUsageCredits();
  const navigate = useNavigate();

  const pct = credits ? Math.min((credits.used_credits / credits.total_credits) * 100, 100) : 0;

  return (
    <Card
      className="glass cursor-pointer hover:scale-[1.01] transition-all"
      onClick={() => navigate("/settings/credits")}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted/50">
          <Fuel className={`h-4 w-4 ${pct >= 80 ? "text-destructive" : "text-primary"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold">{isLoading ? "—" : remaining}</p>
          <p className="text-xs text-muted-foreground">Créditos AI</p>
        </div>
        <div className="w-16 h-2 rounded-full bg-muted/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${100 - pct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
