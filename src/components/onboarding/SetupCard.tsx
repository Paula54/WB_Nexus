import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Lock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SetupCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  connected: boolean;
  locked?: boolean;
  lockedMessage?: string;
  neonColor: "green" | "blue" | "purple";
  onAction: () => void;
}

const neonStyles = {
  green: {
    animation: "animate-neon-green",
    border: "border-neon-green/40",
    bg: "bg-neon-green/10",
    text: "text-neon-green",
    glow: "shadow-[0_0_20px_hsl(var(--neon-green)/0.2)]",
    button: "bg-neon-green hover:bg-neon-green/90 text-background",
  },
  blue: {
    animation: "animate-neon-blue",
    border: "border-neon-blue/40",
    bg: "bg-neon-blue/10",
    text: "text-neon-blue",
    glow: "shadow-[0_0_20px_hsl(var(--neon-blue)/0.2)]",
    button: "bg-neon-blue hover:bg-neon-blue/90 text-background",
  },
  purple: {
    animation: "animate-neon-purple",
    border: "border-neon-purple/40",
    bg: "bg-neon-purple/10",
    text: "text-neon-purple",
    glow: "shadow-[0_0_20px_hsl(var(--neon-purple)/0.2)]",
    button: "bg-neon-purple hover:bg-neon-purple/90 text-white",
  },
};

export function SetupCard({
  icon,
  title,
  description,
  connected,
  locked,
  lockedMessage,
  neonColor,
  onAction,
}: SetupCardProps) {
  const s = neonStyles[neonColor];

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-500 border-2",
        connected ? `${s.border} ${s.glow}` : locked ? "border-muted/30 opacity-60" : `${s.border} hover:${s.glow}`,
        !locked && !connected && s.animation
      )}
    >
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col items-center text-center gap-4">
          {/* Icon */}
          <div className={cn("p-4 rounded-2xl", connected ? s.bg : locked ? "bg-muted/30" : s.bg)}>
            {icon}
          </div>

          {/* Title & Description */}
          <div>
            <h3 className="text-xl font-display font-bold text-foreground mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {/* Status Badge */}
          {connected ? (
            <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full", s.bg)}>
              <Check className={cn("h-5 w-5", s.text)} />
              <span className={cn("font-semibold text-sm", s.text)}>Ligado</span>
            </div>
          ) : locked ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/30">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold text-sm text-muted-foreground">{lockedMessage || "Bloqueado"}</span>
            </div>
          ) : (
            <Button
              onClick={onAction}
              className={cn("gap-2 font-semibold px-6", s.button)}
              size="lg"
            >
              Configurar
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
