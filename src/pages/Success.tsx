import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail } from "lucide-react";

export default function Success() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-lg space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
          Pagamento Confirmado!
        </h1>
        <p className="text-lg text-muted-foreground">
          O seu plano foi ativado com sucesso. Enviámos um <strong>email de ativação</strong> para o endereço utilizado no checkout.
        </p>

        <div className="bg-muted/50 rounded-lg p-5 space-y-3 text-left">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">Verifique a sua caixa de email</p>
              <p className="text-sm text-muted-foreground">
                Clique no link do email para definir a sua password e aceder ao dashboard. Se não encontrar o email, verifique a pasta de spam.
              </p>
            </div>
          </div>
        </div>

        <Button asChild variant="outline" size="lg" className="mt-4">
          <Link to="/auth">
            Já tenho conta — Fazer Login
          </Link>
        </Button>
      </div>
    </div>
  );
}
