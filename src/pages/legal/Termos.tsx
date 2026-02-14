import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

export default function Termos() {
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
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-display font-bold">Termos de Serviço</h1>
        </div>

        <div className="prose prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            Última atualização: Fevereiro de 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Identificação do Prestador</h2>
            <p>
              A plataforma <strong>Nexus AI-OS</strong> é operada pela <strong>Astrolábio Mágico Investimentos, Lda.</strong>
              {" "}(NIF: 515346969), com sede na Estrada da Malveira da Serra, 920, Aldeia de Juso, 2750-834 Cascais, Portugal.
            </p>
            <p>
              Contacto: <a href="mailto:paula1silvasantos@gmail.com" className="text-primary underline">paula1silvasantos@gmail.com</a>
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Objeto do Serviço</h2>
            <p>
              O Nexus AI-OS é um <strong>Sistema Operativo de Inteligência Artificial</strong> destinado à gestão de investimentos
              e automação de marketing. A plataforma processa dados para otimização de campanhas publicitárias,
              análise de métricas de investimento e automação de redes sociais.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. Isenção de Responsabilidade</h2>
            <p className="font-medium text-destructive">
              IMPORTANTE: O Nexus AI-OS é uma ferramenta tecnológica. O utilizador é o único responsável
              pela conformidade legal do conteúdo que publica e dos dados que processa através da plataforma.
            </p>
            <p>
              A Astrolábio Mágico Investimentos, Lda. não assume responsabilidade por:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Conteúdo gerado pela IA que possa violar direitos de terceiros</li>
              <li>Resultados de investimentos baseados em análises da plataforma</li>
              <li>Utilização dos dados de leads inseridos pelo utilizador</li>
              <li>Conformidade com regulamentos específicos do setor do utilizador</li>
              <li>Resultados de campanhas de marketing executadas através da plataforma</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Obrigações do Utilizador</h2>
            <p>O utilizador compromete-se a:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Fornecer informações verdadeiras e atualizadas</li>
              <li>Obter consentimento adequado para processamento de dados de terceiros</li>
              <li>Não utilizar a plataforma para fins ilegais</li>
              <li>Manter a confidencialidade das credenciais de acesso</li>
              <li>Cumprir a legislação aplicável ao seu setor de atividade</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo gerado através da plataforma pertence ao utilizador. A tecnologia,
              design e código da plataforma Nexus AI-OS são propriedade da Astrolábio Mágico Investimentos, Lda.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">6. Lei Aplicável e Foro</h2>
            <p>
              Estes termos são regidos pela lei portuguesa. Para resolução de litígios, as partes
              elegem o foro da Comarca de Cascais, com renúncia a qualquer outro.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">7. Livro de Reclamações</h2>
            <p>
              Disponível em:{" "}
              <a href="https://www.livroreclamacoes.pt" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                www.livroreclamacoes.pt
              </a>
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
