import { Badge } from "@/components/ui/badge";
import { 
  Globe, 
  Share2, 
  Zap, 
  MessageCircle, 
  Search, 
  Megaphone,
  Crown,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanType } from "@/types/nexus";

interface PlanOption {
  id: PlanType;
  name: string;
  subtitle: string;
  anchorPrice: string;
  anchorLabel: string;
  features: Array<{ label: string; icon: React.ReactNode }>;
  isHero?: boolean;
}

const PLANS: PlanOption[] = [
  {
    id: "START",
    name: "START",
    subtitle: "Essencial",
    anchorPrice: "490€ + 29€/mês",
    anchorLabel: "Preço avulso equivalente",
    features: [
      { label: "Site profissional", icon: <Globe className="h-4 w-4" /> },
      { label: "SEO básico", icon: <Search className="h-4 w-4" /> },
      { label: "1 revisão/mês", icon: <Check className="h-4 w-4" /> },
    ],
  },
  {
    id: "GROWTH",
    name: "GROWTH",
    subtitle: "Marketing",
    anchorPrice: "890€ + 99€/mês",
    anchorLabel: "Preço avulso equivalente",
    features: [
      { label: "Site avançado", icon: <Globe className="h-4 w-4" /> },
      { label: "Social Media", icon: <Share2 className="h-4 w-4" /> },
      { label: "SEO completo", icon: <Search className="h-4 w-4" /> },
      { label: "Google Ads", icon: <Megaphone className="h-4 w-4" /> },
    ],
  },
  {
    id: "NEXUS_OS",
    name: "NEXUS OS",
    subtitle: "Elite — O Plano Inteligente",
    anchorPrice: "1.490€/ano",
    anchorLabel: "Tudo incluído",
    isHero: true,
    features: [
      { label: "Site premium", icon: <Globe className="h-4 w-4" /> },
      { label: "Social Media diário", icon: <Share2 className="h-4 w-4" /> },
      { label: "Google + Meta Ads", icon: <Megaphone className="h-4 w-4" /> },
      { label: "SEO avançado", icon: <Search className="h-4 w-4" /> },
      { label: "WhatsApp AI", icon: <MessageCircle className="h-4 w-4" /> },
      { label: "Automação total", icon: <Zap className="h-4 w-4" /> },
    ],
  },
];

interface PlanSelectorProps {
  selected: PlanType;
  onSelect: (plan: PlanType) => void;
}

export function PlanSelector({ selected, onSelect }: PlanSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <Badge className="bg-nexus-gold/20 text-nexus-gold border-nexus-gold/30 px-4 py-1.5 text-sm font-medium">
          🎁 Experimenta qualquer plano GRÁTIS por 14 dias
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect(plan.id)}
              className={cn(
                "relative flex flex-col rounded-xl border-2 p-5 text-left transition-all duration-300",
                "hover:shadow-lg hover:scale-[1.02]",
                plan.isHero && !isSelected && "border-nexus-gold/40 bg-nexus-gold/5",
                plan.isHero && isSelected && "border-nexus-gold bg-nexus-gold/10 shadow-[0_0_30px_hsl(var(--nexus-gold)/0.2)]",
                !plan.isHero && !isSelected && "border-border bg-card/60",
                !plan.isHero && isSelected && "border-primary bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.15)]",
              )}
            >
              {/* Hero badge */}
              {plan.isHero && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-nexus-gold text-nexus-navy border-0 px-3 py-0.5 text-xs font-bold flex items-center gap-1">
                    <Crown className="h-3 w-3" />
                    RECOMENDADO
                  </Badge>
                </div>
              )}

              {/* Selection indicator */}
              <div className={cn(
                "absolute top-3 right-3 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                isSelected 
                  ? plan.isHero 
                    ? "border-nexus-gold bg-nexus-gold" 
                    : "border-primary bg-primary"
                  : "border-muted-foreground/30"
              )}>
                {isSelected && <Check className="h-3 w-3 text-nexus-navy" />}
              </div>

              {/* Plan name */}
              <div className="mb-3 mt-1">
                <h3 className={cn(
                  "text-lg font-display font-bold",
                  plan.isHero ? "text-nexus-gold" : "text-foreground"
                )}>
                  {plan.name}
                </h3>
                <p className="text-xs text-muted-foreground">{plan.subtitle}</p>
              </div>

              {/* Price */}
              <div className="mb-4">
                <p className={cn(
                  "text-xl font-bold font-display",
                  plan.isHero ? "text-nexus-gold" : "text-foreground"
                )}>
                  {plan.anchorPrice}
                </p>
                <p className="text-[10px] text-muted-foreground">{plan.anchorLabel}</p>
              </div>

              {/* Features */}
              <ul className="space-y-2 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className={cn(
                      plan.isHero ? "text-nexus-gold" : "text-primary"
                    )}>
                      {feature.icon}
                    </span>
                    {feature.label}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
