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
              O <strong>Nexus</strong> é um produto tecnológico operado pela <strong>Web Business</strong> (<a href="https://web-business.pt" target="_blank" rel="noopener noreferrer" className="text-primary underline">web-business.pt</a>),
              marca ativa desde 2013 no setor digital, pertencente à <strong>Astrolábio Mágico Investimentos, Lda.</strong> (NIF: 515346969),
              com sede na Estrada da Malveira da Serra, 920, Aldeia de Juso, 2750-834 Cascais, Portugal.
            </p>
            <p>
              A Astrolábio Mágico Investimentos, Lda. é a entidade legalmente responsável pelo tratamento dos dados pessoais
              recolhidos através da plataforma <strong>Nexus AI-OS</strong>, parte integrante do ecossistema tecnológico da Web Business.
            </p>
            <p>
              Contacto oficial de suporte:{" "}
              <a href="mailto:info@astrolabio-magico-invest.pt" className="text-primary underline">
                info@astrolabio-magico-invest.pt
              </a>
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. O que é o Nexus AI-OS</h2>
            <p>
              O Nexus é um <strong>AI-OS (Sistema Operativo de Inteligência Artificial)</strong> desenvolvido pela
              Web Business para marketing digital e automação de negócios, desenhado para qualquer setor de atividade.
              Com mais de uma década de experiência no ecossistema digital, a Web Business garante conformidade
              com o RGPD em todas as operações da plataforma. As suas funções principais incluem:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Automação de publicações em redes sociais (Instagram e Facebook)</li>
              <li>Gestão de campanhas de anúncios através da Marketing API</li>
              <li>Análise de métricas de performance e Business Intelligence</li>
              <li>Gestão de relacionamento com clientes (CRM)</li>
              <li>Geração de estratégias e conteúdo assistido por IA</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. Dados Recolhidos</h2>
            <p>Recolhemos os seguintes tipos de dados:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Dados de identificação (nome, email)</li>
              <li>Dados de contacto (telefone, empresa)</li>
              <li>Dados de utilização da plataforma e métricas de campanhas</li>
              <li>Dados de leads e contactos comerciais inseridos pelo utilizador</li>
              <li>Dados obtidos através da integração com a <strong>Meta Graph API</strong> (páginas do Facebook, contas de Instagram, métricas de publicações e campanhas publicitárias)</li>
              <li>Dados de integração com plataformas de publicidade (Meta Ads, Google Ads)</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Finalidade do Tratamento</h2>
            <p>Os dados são tratados exclusivamente para as seguintes finalidades:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Automação e agendamento de publicações em redes sociais do utilizador</li>
              <li>Criação, gestão e otimização de campanhas publicitárias (Marketing API)</li>
              <li>Análise de métricas de performance e geração de relatórios de Business Intelligence</li>
              <li>Gestão de relacionamento com clientes e leads (CRM)</li>
              <li>Geração de estratégias de marketing e conteúdo assistido por IA</li>
              <li>Comunicações de serviço e suporte técnico</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Utilização de Dados da Meta Graph API</h2>
            <p>
              O Nexus AI-OS utiliza a <strong>Meta Graph API</strong> para aceder a dados das contas de
              Facebook e Instagram do utilizador. Declaramos que:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Os dados recolhidos via Meta Graph API são utilizados <strong>exclusivamente</strong> para fins de marketing digital e gestão de negócio do próprio utilizador</li>
              <li>Não vendemos, partilhamos ou transferimos dados obtidos da Meta a terceiros</li>
              <li>Os dados são processados de forma segura pela infraestrutura do Nexus, com encriptação em trânsito e em repouso</li>
              <li>O utilizador pode revogar o acesso à sua conta Meta a qualquer momento através das definições da plataforma</li>
              <li>Os tokens de acesso são armazenados de forma encriptada e utilizados apenas para as operações autorizadas pelo utilizador</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6. Base Legal</h2>
            <p>
              O tratamento de dados é realizado com base no <strong>consentimento explícito</strong> do titular,
              na execução de contrato de prestação de serviços e no cumprimento de obrigações legais,
              em conformidade com o <strong>Regulamento Geral de Proteção de Dados (RGPD — Regulamento UE 2016/679)</strong>,
              Art. 6.º, n.º 1, alíneas a), b) e c).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">7. Direitos dos Titulares</h2>
            <p>
              Nos termos do RGPD, tem direito a aceder, retificar, apagar, limitar o tratamento,
              portabilidade e oposição ao tratamento dos seus dados pessoais. Para exercer estes direitos,
              contacte-nos através do email{" "}
              <a href="mailto:info@astrolabio-magico-invest.pt" className="text-primary underline">
                info@astrolabio-magico-invest.pt
              </a>.
            </p>
            <p>
              Pode ainda apresentar reclamação à <strong>CNPD — Comissão Nacional de Proteção de Dados</strong>{" "}
              (<a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer" className="text-primary underline">www.cnpd.pt</a>).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">8. Segurança dos Dados</h2>
            <p>
              Implementamos medidas técnicas e organizativas adequadas para proteger os dados pessoais contra
              acessos não autorizados, perda ou destruição, incluindo:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encriptação de dados em trânsito (TLS/SSL) e em repouso</li>
              <li>Controlo de acessos baseado em funções (RBAC)</li>
              <li>Registos de auditoria e monitorização contínua</li>
              <li>Armazenamento seguro de tokens e credenciais de API</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">9. Retenção de Dados</h2>
            <p>
              Os dados são conservados pelo período estritamente necessário à prestação dos serviços contratados
              e ao cumprimento de obrigações legais. Após o término da relação contratual, os dados são eliminados
              no prazo máximo de 90 dias, salvo obrigação legal de conservação mais prolongada.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">10. Transferências Internacionais</h2>
            <p>
              Os dados podem ser processados em servidores localizados no Espaço Económico Europeu (EEE).
              Caso sejam necessárias transferências para fora do EEE, estas serão realizadas com base em
              mecanismos de proteção adequados, conforme o Capítulo V do RGPD.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>Nexus © 2026 | Powered by <a href="https://web-business.pt" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Web Business</a> – Um produto Astrolábio Mágico Investimentos LDA.</p>
          <p className="mt-1">Estrada da Malveira da Serra, 920, Aldeia de Juso, 2750-834 Cascais</p>
        </div>
      </div>
    </div>
  );
}
