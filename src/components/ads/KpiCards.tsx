import { Card, CardContent } from "@/components/ui/card";
import { Eye, MousePointer, TrendingUp, DollarSign } from "lucide-react";

interface KpiCardsProps {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  ctr: string;
  costPerLead: string;
}

export default function KpiCards({
  totalImpressions,
  totalClicks,
  totalSpend,
  ctr,
  costPerLead,
}: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="glass">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Impressões</p>
              <p className="text-2xl font-bold">{totalImpressions.toLocaleString()}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Eye className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Cliques</p>
              <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">CTR: {ctr}%</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-accent/30 flex items-center justify-center">
              <MousePointer className="h-6 w-6 text-accent-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Custo por Lead</p>
              <p className="text-2xl font-bold">€{costPerLead}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-secondary/30 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-secondary-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Gasto Total</p>
              <p className="text-2xl font-bold">€{totalSpend.toFixed(2)}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-destructive" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
