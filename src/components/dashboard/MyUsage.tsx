import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuotaCheck } from "@/hooks/useQuotaCheck";
import { Bot, FileText, Activity, MessageCircle } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  START: "Start",
  GROWTH: "Growth",
  NEXUS_OS: "Nexus OS",
};

export function MyUsage() {
  const { quota, isLoading } = useQuotaCheck();

  if (isLoading || !quota) return null;

  const items = [
    {
      label: "Concierge IA",
      used: quota.concierge_used,
      limit: quota.concierge_limit,
      icon: Bot,
      color: "bg-primary",
    },
    {
      label: "Posts de Blog",
      used: quota.blog_used,
      limit: quota.blog_limit,
      icon: FileText,
      color: "bg-neon-purple",
    },
    {
      label: "Scans Performance",
      used: quota.perf_scan_used,
      limit: quota.perf_scan_limit,
      icon: Activity,
      color: "bg-neon-green",
    },
    {
      label: "WhatsApp IA",
      used: quota.whatsapp_ai_used,
      limit: quota.whatsapp_ai_limit,
      icon: MessageCircle,
      color: "bg-emerald-500",
      hidden: quota.whatsapp_ai_limit === 0,
    },
  ];

  const visibleItems = items.filter((i) => !i.hidden);

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Quotas do Plano
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {PLAN_LABELS[quota.plan_type] ?? quota.plan_type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {visibleItems.map((item) => {
          const pct =
            item.limit > 0
              ? Math.min((item.used / item.limit) * 100, 100)
              : 0;
          const isNearLimit = pct >= 80;
          const isUnlimited = item.limit >= 9999;

          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </span>
                <span
                  className={`text-xs font-medium ${
                    isNearLimit && !isUnlimited
                      ? "text-destructive"
                      : "text-foreground"
                  }`}
                >
                  {item.used} / {isUnlimited ? "∞" : item.limit}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isNearLimit && !isUnlimited ? "bg-destructive" : item.color
                  }`}
                  style={{ width: isUnlimited ? "5%" : `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
