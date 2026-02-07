import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface TrialExpiredBannerProps {
  plan: string | null;
}

export default function TrialExpiredBanner({ plan }: TrialExpiredBannerProps) {
  const navigate = useNavigate();

  return (
    <Card className="border-destructive/50 bg-destructive/10">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Subscrição Necessária</h3>
          <p className="text-sm text-muted-foreground">
            O período experimental do plano{" "}
            <span className="font-semibold text-foreground">{plan || "Nexus"}</span>{" "}
            expirou. Ativa a tua subscrição para continuar a utilizar as funcionalidades de execução.
          </p>
        </div>
        <Button variant="default" size="sm" onClick={() => navigate("/strategy")}>
          Ver Planos
        </Button>
      </CardContent>
    </Card>
  );
}
