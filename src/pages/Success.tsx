import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Rocket } from "lucide-react";

export default function Success() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-lg space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
          Bem-vindo ao <span className="text-primary">Nexus OS</span>!
        </h1>
        <p className="text-lg text-muted-foreground">
          Pagamento confirmado com sucesso. O seu ecossistema digital está a ser preparado — em segundos terá tudo pronto para começar a crescer.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Rocket className="h-4 w-4 text-primary" />
          <span>O seu plano já está ativo.</span>
        </div>
        <Button asChild size="lg" className="mt-4">
          <Link to="/">
            Ir para o Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
