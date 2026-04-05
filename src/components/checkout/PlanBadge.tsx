import { CheckCircle2 } from "lucide-react";
import type { PlanConfig } from "@/data/plans";

interface PlanBadgeProps {
  plan: PlanConfig;
}

export function PlanBadge({ plan }: PlanBadgeProps) {
  return (
    <div className="flex justify-center">
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm">
        <CheckCircle2 className="h-4 w-4" />
        {plan.name} — {plan.setupFee}€ + {plan.monthlyPrice}€/mês
      </span>
    </div>
  );
}
