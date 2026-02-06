import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const SERVICES = [
  { name: "Site Profissional", avulso: "490€ + 29€/mês", nexus: true },
  { name: "Social Media (gestão mensal)", avulso: "199€/mês", nexus: true },
  { name: "Google Ads (setup + gestão)", avulso: "150€ + 99€/mês", nexus: true },
  { name: "Meta Ads (setup + gestão)", avulso: "150€ + 99€/mês", nexus: true },
  { name: "SEO Avançado", avulso: "249€/mês", nexus: true },
  { name: "WhatsApp AI Bot", avulso: "299€ setup", nexus: true },
  { name: "Concierge IA Pessoal", avulso: "Não disponível", nexus: true },
];

export function DecoyComparison() {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="grid grid-cols-3 bg-muted/50">
        <div className="p-4 text-sm font-semibold text-muted-foreground">Serviço</div>
        <div className="p-4 text-sm font-semibold text-center text-muted-foreground">
          Serviços Avulsos
        </div>
        <div className="p-4 text-sm font-semibold text-center">
          <Badge className="bg-nexus-gold text-nexus-navy border-0">Nexus OS</Badge>
        </div>
      </div>

      {SERVICES.map((service, i) => (
        <div
          key={service.name}
          className={`grid grid-cols-3 border-t border-border ${i % 2 === 0 ? "bg-card/40" : "bg-card/20"}`}
        >
          <div className="p-3 text-sm text-foreground">{service.name}</div>
          <div className="p-3 text-sm text-center text-destructive/80 line-through">
            {service.avulso}
          </div>
          <div className="p-3 flex justify-center">
            {service.nexus ? (
              <Check className="h-5 w-5 text-nexus-gold" />
            ) : (
              <X className="h-5 w-5 text-muted-foreground/30" />
            )}
          </div>
        </div>
      ))}

      {/* Total row */}
      <div className="grid grid-cols-3 border-t-2 border-nexus-gold/30 bg-nexus-gold/5">
        <div className="p-4 text-sm font-bold text-foreground">Total Anual Estimado</div>
        <div className="p-4 text-center">
          <span className="text-lg font-bold text-destructive line-through">~9.200€+</span>
        </div>
        <div className="p-4 text-center">
          <span className="text-lg font-bold text-nexus-gold">1.490€/ano</span>
        </div>
      </div>

      <div className="p-4 text-center bg-nexus-gold/5 border-t border-nexus-gold/20">
        <p className="text-sm text-muted-foreground">
          💡 <strong className="text-nexus-gold">Poupar mais de 7.700€/ano</strong> — a escolha inteligente para quem quer resultados.
        </p>
      </div>
    </div>
  );
}
