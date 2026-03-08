import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Share2,
  Zap,
  MessageCircle,
  Search,
  Megaphone,
  Crown,
  Check,
  ShieldCheck,
  BarChart3,
  CreditCard,
  Headphones,
  Users,
  Mail,
  LineChart,
  Bot,
  RefreshCw,
  FileText,
  Layout,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanType } from "@/types/nexus";

interface PlanFeature {
  label: string;
  icon: React.ReactNode;
}

interface PlanOption {
  id: PlanType;
  name: string;
  subtitle: string;
  price: string;
  priceDetail: string;
  features: PlanFeature[];
  isHero?: boolean;
}

const PLANS: PlanOption[] = [
  {
    id: "START",
    name: "Start",
    subtitle: "O Essencial para Arrancar",
    price: "490€ + 29€/mês",
    priceDetail: "Setup + mensalidade",
    features: [
      { label: "Landing Page profissional e responsiva", icon: <Globe className="h-4 w-4" /> },
      { label: "Certificado SSL e conformidade RGPD", icon: <ShieldCheck className="h-4 w-4" /> },
      { label: "SEO básico e indexação no Google", icon: <Search className="h-4 w-4" /> },
      { label: "Integração Google Analytics", icon: <BarChart3 className="h-4 w-4" /> },
      { label: "Relatório Mensal de Performance", icon: <LineChart className="h-4 w-4" /> },
      { label: "Integração Stripe (Checkout Seguro)", icon: <CreditCard className="h-4 w-4" /> },
      { label: "Concierge de Suporte na App", icon: <Headphones className="h-4 w-4" /> },
    ],
  },
  {
    id: "GROWTH",
    name: "Growth",
    subtitle: "O Motor de Vendas",
    price: "890€ + 99€/mês",
    priceDetail: "Setup + mensalidade",
    features: [
      { label: "Tudo do Plano Start, mais:", icon: <Check className="h-4 w-4" /> },
      { label: "Site completo com múltiplas páginas e blog", icon: <Layout className="h-4 w-4" /> },
      { label: "Painel de Controlo em tempo real", icon: <BarChart3 className="h-4 w-4" /> },
      { label: "Relatório Semanal de Performance", icon: <LineChart className="h-4 w-4" /> },
      { label: "Social Media e Google Ads", icon: <Megaphone className="h-4 w-4" /> },
      { label: "Captura de Leads e Email Marketing", icon: <Mail className="h-4 w-4" /> },
      { label: "Suporte prioritário via Concierge Mentor", icon: <Headphones className="h-4 w-4" /> },
    ],
  },
  {
    id: "NEXUS_OS",
    name: "Nexus OS",
    subtitle: "A Agência Completa com IA",
    price: "1.490€/ano",
    priceDetail: "Pagamento anual",
    isHero: true,
    features: [
      { label: "Tudo do Plano Growth, mais:", icon: <Check className="h-4 w-4" /> },
      { label: "WhatsApp AI — Atendimento automático", icon: <MessageCircle className="h-4 w-4" /> },
      { label: "CRM integrado e pipeline de vendas", icon: <Users className="h-4 w-4" /> },
      { label: "Gestão total de Meta Ads", icon: <Megaphone className="h-4 w-4" /> },
      { label: "Relatórios de Conversão e ROI em tempo real", icon: <LineChart className="h-4 w-4" /> },
      { label: "IA Insights — Sugestões estratégicas", icon: <Bot className="h-4 w-4" /> },
      { label: "Revisões ilimitadas e SLA garantido", icon: <RefreshCw className="h-4 w-4" /> },
    ],
  },
];

interface PlanSelectorProps {
  selected: PlanType;
  onSelect: (plan: PlanType) => void;
}

export function PlanSelector({ selected, onSelect }: PlanSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <Badge className="bg-nexus-gold/20 text-nexus-gold border-nexus-gold/30 px-4 py-1.5 text-sm font-medium">
          🎁 Experimenta qualquer plano GRÁTIS por 14 dias
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect(plan.id)}
              className={cn(
                "relative flex flex-col rounded-xl border-2 p-6 text-left transition-all duration-300",
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
              <div className="mb-4 mt-1">
                <h3 className={cn(
                  "text-xl font-display font-bold",
                  plan.isHero ? "text-nexus-gold" : "text-foreground"
                )}>
                  {plan.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.subtitle}</p>
              </div>

              {/* Price */}
              <div className="mb-5">
                <p className={cn(
                  "text-2xl font-bold font-display",
                  plan.isHero ? "text-nexus-gold" : "text-foreground"
                )}>
                  {plan.price}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{plan.priceDetail}</p>
              </div>

              {/* Divider */}
              <div className="border-t border-border/50 mb-4" />

              {/* Features */}
              <ul className="space-y-2.5 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature.label} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className={cn(
                      "mt-0.5 shrink-0",
                      plan.isHero ? "text-nexus-gold" : "text-primary"
                    )}>
                      {feature.icon}
                    </span>
                    <span>{feature.label}</span>
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
