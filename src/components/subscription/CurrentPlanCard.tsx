import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Zap, Rocket, CalendarDays, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubscriptionData } from "@/hooks/useSubscription";

const PLAN_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  START: { label: "Nexus Start", icon: <Zap className="h-5 w-5" />, color: "text-primary" },
  GROWTH: { label: "Nexus Growth", icon: <Rocket className="h-5 w-5" />, color: "text-blue-400" },
  NEXUS_OS: { label: "Nexus OS", icon: <Crown className="h-5 w-5" />, color: "text-nexus-gold" },
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  trialing: { label: "Período Experimental", variant: "secondary" },
  canceled: { label: "Cancelado", variant: "destructive" },
  past_due: { label: "Pagamento Pendente", variant: "destructive" },
  incomplete: { label: "Incompleto", variant: "outline" },
};

interface CurrentPlanCardProps {
  subscription: SubscriptionData;
}

export function CurrentPlanCard({ subscription }: CurrentPlanCardProps) {
  const plan = PLAN_META[subscription.plan_type] ?? PLAN_META.START;
  const status = STATUS_MAP[subscription.status] ?? STATUS_MAP.active;

  const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
  const isTrialing = subscription.status === "trialing";
  const now = new Date();
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)) : 0;

  return (
    <Card className="glass border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className={plan.color}>{plan.icon}</span>
            Plano Atual
          </CardTitle>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center",
            subscription.plan_type === "NEXUS_OS" ? "bg-nexus-gold/15" : "bg-primary/15"
          )}>
            <span className={plan.color}>{plan.icon}</span>
          </div>
          <div>
            <p className={cn("text-2xl font-display font-bold", plan.color)}>
              {plan.label}
            </p>
            <p className="text-xs text-muted-foreground">
              Gerido pelo site principal
            </p>
          </div>
        </div>

        <div className="border-t border-border/50 pt-3 space-y-2">
          {isTrialing && trialEnd && (
            <div className="flex items-center gap-2 text-sm">
              {trialDaysLeft > 3 ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              )}
              <span className="text-muted-foreground">
                Trial termina em <strong className="text-foreground">{trialDaysLeft} dias</strong>
                {" "}({trialEnd.toLocaleDateString("pt-PT")})
              </span>
            </div>
          )}
          {periodEnd && !isTrialing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Próxima faturação: {periodEnd.toLocaleDateString("pt-PT")}
            </div>
          )}
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs mt-1">
            <a href="https://site.web-business.pt/#pricing" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              Alterar plano no site
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
