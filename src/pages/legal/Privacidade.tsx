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
            Última atualização: Fevereiro de 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Responsável pelo Tratamento</h2>
            <p>
              A <strong>Astrolábio Mágico Investimentos, Lda.</strong> (NIF: 515346969), com sede na
              Estrada da Malveira da Serra, 920, Aldeia de Juso, 2750-834 Cascais, Portugal,
              é a entidade responsável pelo tratamento dos dados pessoais recolhidos através da plataforma <strong>Nexus AI-OS</strong>.
            </p>
            <p>
              Contacto: <a href="mailto:paula1silvasantos@gmail.com" className="text-primary underline">paula1silvasantos@gmail.com</a>
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. O que é o Nexus AI-OS</h2>
            <p>
              O Nexus é um <strong>Sistema Operativo de Inteligência Artificial (AI-OS)</strong> destinado à gestão de investimentos
              e automação de marketing. A plataforma processa dados para otimização de campanhas publicitárias,
              análise de métricas de investimento e automação de redes sociais.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. Dados Recolhidos</h2>
            <p>Recolhemos os seguintes tipos de dados:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Dados de identificação (nome, email)</li>
              <li>Dados de contacto (telefone, empresa)</li>
              <li>Dados de utilização da plataforma e métricas de campanhas</li>
              <li>Dados de leads e contactos comerciais inseridos pelo utilizador</li>
              <li>Dados de integração com plataformas de publicidade (Meta Ads, Google Ads)</li>
              <li>Dados de redes sociais conectadas pelo utilizador</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Finalidade do Tratamento</h2>
            <p>Os dados são tratados para:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Processamento e otimização de campanhas publicitárias</li>
              <li>Análise de métricas de investimento e performance</li>
              <li>Automação de publicações em redes sociais</li>
              <li>Gestão de relacionamento com clientes (CRM)</li>
              <li>Geração de estratégias e conteúdo assistido por IA</li>
              <li>Comunicações de serviço e suporte técnico</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Base Legal</h2>
            <p>
              O tratamento é realizado com base no consentimento do titular, na execução de contrato
              e no cumprimento de obrigações legais (RGPD, Art. 6.º).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6. Direitos dos Titulares</h2>
            <p>
              Nos termos do RGPD, tem direito a aceder, retificar, apagar, limitar o tratamento,
              portabilidade e oposição ao tratamento dos seus dados. Para exercer estes direitos,
              contacte-nos através do email{" "}
              <a href="mailto:paula1silvasantos@gmail.com" className="text-primary underline">paula1silvasantos@gmail.com</a>.
            </p>
            <p>
              Pode ainda apresentar reclamação à <strong>CNPD — Comissão Nacional de Proteção de Dados</strong>.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">7. Segurança</h2>
            <p>
              Implementamos medidas técnicas e organizativas adequadas para proteger os dados contra
              acessos não autorizados, incluindo encriptação, controlo de acessos e registos de auditoria.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">8. Retenção de Dados</h2>
            <p>
              Os dados são conservados pelo período necessário à prestação dos serviços e cumprimento
              de obrigações legais. Os registos de auditoria são mantidos por 90 dias (365 dias para
              logs de segurança).
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
