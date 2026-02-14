import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCcw } from "lucide-react";

export default function Devolucoes() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12 px-4">
        <Button asChild variant="ghost" className="mb-8">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <RefreshCcw className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-display font-bold">Política de Devoluções</h1>
        </div>

        <div className="prose prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            Última atualização: Fevereiro de 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Serviços Digitais</h2>
            <p>
              O <strong>Nexus AI-OS</strong> é um serviço digital de subscrição operado pela{" "}
              <strong>Astrolábio Mágico Investimentos, Lda.</strong> (NIF: 515346969).
              Por natureza, os serviços digitais não são elegíveis para devolução física, mas oferecemos garantias de satisfação.
            </p>
            <p>
              Contacto: <a href="mailto:info@astrolabio-magico-invest.pt" className="text-primary underline">info@astrolabio-magico-invest.pt</a>
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Período de Experimentação</h2>
            <p>
              Oferecemos um período de teste gratuito durante o qual pode avaliar as funcionalidades 
              da plataforma. Não é necessário fornecer dados de pagamento durante este período.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. Cancelamento de Subscrição</h2>
            <p>
              Pode cancelar a sua subscrição a qualquer momento através das definições da sua conta. 
              O cancelamento terá efeito no final do período de faturação em curso.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Subscrições mensais: acesso até ao final do mês pago</li>
              <li>Subscrições anuais: acesso até ao final do ano pago</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Reembolsos</h2>
            <p>
              Consideramos pedidos de reembolso nas seguintes situações:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Cobrança duplicada por erro técnico</li>
              <li>Incapacidade de aceder ao serviço por mais de 48 horas consecutivas (excluindo manutenção programada)</li>
              <li>Cancelamento dentro de 14 dias após a primeira cobrança (direito de arrependimento)</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Como Solicitar Reembolso</h2>
            <p>
              Para solicitar um reembolso, contacte a nossa equipa de suporte através da página de 
              contacto, indicando o motivo do pedido e os dados da faturação.
            </p>
            <p>
              Os reembolsos aprovados serão processados no prazo de 10 dias úteis através do mesmo 
              método de pagamento utilizado na compra.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6. Direito de Arrependimento</h2>
            <p>
              Nos termos da legislação europeia, tem o direito de cancelar o contrato no prazo de 
              14 dias sem necessidade de justificação. Este direito não se aplica caso tenha 
              utilizado ativamente o serviço durante esse período.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© 2026 Astrolábio Mágico Investimentos, Lda. Todos os direitos reservados.</p>
          <p className="mt-1">Estrada da Malveira da Serra, 920, Aldeia de Juso, 2750-834 Cascais</p>
        </div>
      </div>
    </div>
  );
}
