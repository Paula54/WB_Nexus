import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";

export default function Privacidade() {
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
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-display font-bold">Política de Privacidade</h1>
        </div>

        <div className="prose prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            Última atualização: Janeiro de 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Responsável pelo Tratamento</h2>
            <p>
              A <strong>Astrolábio Mágico Investimentos, Lda.</strong> (NIF: 515346969), com sede em Cascais, Portugal, 
              é a entidade responsável pelo tratamento dos dados pessoais recolhidos através da plataforma Nexus AI.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Dados Recolhidos</h2>
            <p>Recolhemos os seguintes tipos de dados:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Dados de identificação (nome, email)</li>
              <li>Dados de contacto (telefone, empresa)</li>
              <li>Dados de utilização da plataforma</li>
              <li>Dados de leads e contactos comerciais inseridos pelo utilizador</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. Finalidade do Tratamento</h2>
            <p>Os dados são tratados para:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Prestação dos serviços da plataforma Nexus AI</li>
              <li>Gestão de relacionamento com clientes</li>
              <li>Comunicações de serviço e suporte</li>
              <li>Melhorias na plataforma e análise de utilização</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Direitos dos Titulares</h2>
            <p>
              Nos termos do RGPD, tem direito a aceder, retificar, apagar, limitar o tratamento, 
              portabilidade e oposição ao tratamento dos seus dados. Para exercer estes direitos, 
              contacte-nos através do email indicado na página de contacto.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Segurança</h2>
            <p>
              Implementamos medidas técnicas e organizativas adequadas para proteger os dados contra 
              acessos não autorizados, incluindo encriptação, controlo de acessos e registos de auditoria.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6. Retenção de Dados</h2>
            <p>
              Os dados são conservados pelo período necessário à prestação dos serviços e cumprimento 
              de obrigações legais. Os registos de auditoria são mantidos por 90 dias (365 dias para 
              logs de segurança).
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© 2026 Astrolábio Mágico Investimentos, Lda. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
}
