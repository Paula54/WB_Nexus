import { PerformanceTab } from "@/components/dashboard/PerformanceTab";
import { BarChart3 } from "lucide-react";

export default function Performance() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          Desempenho
        </h1>
        <p className="text-muted-foreground mt-1">
          Acompanha o tráfego orgânico e o comportamento dos utilizadores no teu site.
        </p>
      </div>
      <PerformanceTab />
    </div>
  );
}
