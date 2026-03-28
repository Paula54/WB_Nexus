import { AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PRICING_URL = "https://site.web-business.pt/#pricing";

export function NoPlanBanner() {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="p-3 rounded-full bg-destructive/10 shrink-0">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="font-semibold text-foreground text-lg">Sem plano ativo</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Não tens uma subscrição ativa. Escolhe um plano para desbloquear todas as funcionalidades da plataforma.
          </p>
        </div>
        <Button asChild className="shrink-0 gap-2">
          <a href={PRICING_URL} target="_blank" rel="noopener noreferrer">
            Ver Planos
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
