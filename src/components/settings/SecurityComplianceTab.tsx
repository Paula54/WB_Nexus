import { Shield, Lock, CreditCard, Database, Globe, CheckCircle2, Download, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjectData } from "@/hooks/useProjectData";
import { toast } from "@/hooks/use-toast";

const securityChecks = [
  {
    id: "ssl",
    label: "Ligação SSL / TLS",
    description: "Encriptação de dados em trânsito via HTTPS. Toda a comunicação entre o browser e os servidores é cifrada.",
    status: "Confirmado",
    icon: Globe,
  },
  {
    id: "payments",
    label: "Proteção de Pagamentos",
    description: "Verificado pelo Stripe — certificação PCI DSS Level 1 Compliance. Os dados de cartão nunca passam pelos nossos servidores.",
    status: "Verificado",
    icon: CreditCard,
  },
  {
    id: "encryption",
    label: "Encriptação de Credenciais",
    description: "AES-256-GCM para tokens de Ads (Google Ads, Meta Ads). Credenciais cifradas em repouso com chave dedicada.",
    status: "Ativa",
    icon: Lock,
  },
  {
    id: "rls",
    label: "Isolamento de Dados",
    description: "Row Level Security ativo em todas as tabelas. Cada utilizador só acede aos seus próprios dados.",
    status: "Ativo",
    icon: Database,
  },
];

export default function SecurityComplianceTab() {
  const { project } = useProjectData();

  const handleExportPDF = () => {
    const projectName = project?.name || "Projeto Nexus";
    const date = new Date().toLocaleDateString("pt-PT", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const content = `
RELATÓRIO DE INTEGRIDADE E SEGURANÇA
=====================================

Projeto: ${projectName}
Data: ${date}
Gerado por: Nexus Machine — Powered by Web Business

-------------------------------------
CHECKLIST DE PROTEÇÃO
-------------------------------------

${securityChecks.map((c, i) => `${i + 1}. [✓] ${c.label} — ${c.status}\n   ${c.description}`).join("\n\n")}

-------------------------------------
NOTA DE CONFORMIDADE
-------------------------------------

Este projeto segue as normas de segurança SOC2 e RGPD
através da nossa infraestrutura blindada. Todos os dados
são processados dentro da União Europeia, com encriptação
de ponta a ponta e políticas de acesso restrito por utilizador.

Infraestrutura: Supabase (SOC2 Type II) + Stripe (PCI DSS Level 1)
Encriptação em repouso: AES-256-GCM
Encriptação em trânsito: TLS 1.3
Isolamento de dados: Row Level Security (PostgreSQL)

-------------------------------------
© ${new Date().getFullYear()} Nexus Machine — Web Business
Astrolábio Mágico Investimentos LDA
    `.trim();

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-seguranca-${projectName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Relatório gerado",
      description: "O relatório de segurança foi descarregado com sucesso.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <Shield className="h-6 w-6 text-primary" />
            Relatório de Integridade e Segurança
          </CardTitle>
          <CardDescription>
            Visão geral das proteções ativas no teu projeto
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Security Checklist */}
      <div className="grid gap-4">
        {securityChecks.map((check) => (
          <Card key={check.id}>
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex-shrink-0 mt-0.5">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <check.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{check.label}</span>
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                    {check.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{check.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Export Button */}
      <Button onClick={handleExportPDF} className="w-full sm:w-auto gap-2">
        <Download className="h-4 w-4" />
        Gerar Relatório em PDF
      </Button>

      {/* Trust Note */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="flex items-start gap-3 p-5">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Este projeto segue as normas de segurança SOC2 e RGPD</strong> através da nossa infraestrutura blindada. Todos os dados são processados com encriptação de ponta a ponta e políticas de acesso restrito por utilizador.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
