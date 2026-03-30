import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * PlanSelector — In the App (Projeto B), plans are NOT sold here.
 * We show a read-only message pointing users to the marketing site.
 */
export function PlanSelector() {
  return (
    <Card className="glass border-dashed border-muted-foreground/20">
      <CardContent className="py-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Os planos Nexus são geridos no site principal.
        </p>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href="https://site.web-business.pt/#pricing" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Ver Planos
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
