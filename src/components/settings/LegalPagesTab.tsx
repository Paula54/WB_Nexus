import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { FileText, Eye, Save, Loader2, AlertTriangle } from "lucide-react";

interface BusinessData {
  legal_name: string;
  trade_name: string;
  nif: string;
  address_line1: string;
  postal_code: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  website: string;
  complaints_book_url: string;
}

type PageType = "privacidade" | "termos" | "cookies";

const PAGE_LABELS: Record<PageType, string> = {
  privacidade: "Política de Privacidade",
  termos: "Termos e Condições",
  cookies: "Política de Cookies",
};

function generateTemplate(type: PageType, data: BusinessData): string {
  const name = data.trade_name || data.legal_name || "[Nome da Empresa]";
  const legalName = data.legal_name || "[Denominação Social]";
  const nif = data.nif || "[NIF]";
  const address = [data.address_line1, data.postal_code, data.city, data.country].filter(Boolean).join(", ") || "[Morada]";
  const email = data.email || "[email]";
  const phone = data.phone || "[telefone]";
  const website = data.website || "[website]";
  const complaints = data.complaints_book_url || "https://www.livroreclamacoes.pt";

  if (type === "privacidade") {
    return `# Política de Privacidade — ${name}

**Última atualização:** ${new Date().toLocaleDateString("pt-PT")}

## 1. Responsável pelo Tratamento
**${legalName}**, NIF ${nif}, com sede em ${address}.  
Contacto: ${email} | ${phone}

## 2. Dados Recolhidos
Recolhemos os seguintes dados pessoais:
- Nome e apelido
- Endereço de email
- Número de telefone
- Dados de navegação (cookies)

## 3. Finalidade do Tratamento
Os dados são tratados para:
- Prestação dos serviços contratados
- Comunicações comerciais (com consentimento)
- Cumprimento de obrigações legais

## 4. Base Legal
O tratamento é realizado com base no consentimento do titular, na execução de contrato e no cumprimento de obrigações legais (RGPD Art. 6.º).

## 5. Conservação dos Dados
Os dados são conservados durante o período necessário à finalidade do tratamento e por períodos adicionais exigidos por lei.

## 6. Direitos do Titular
Pode exercer os direitos de acesso, retificação, apagamento, portabilidade e oposição contactando ${email}.

## 7. Autoridade de Controlo
Pode apresentar reclamação à CNPD — Comissão Nacional de Proteção de Dados.

## 8. Livro de Reclamações
Disponível em: ${complaints}

---
${name} | ${website}`;
  }

  if (type === "termos") {
    return `# Termos e Condições — ${name}

**Última atualização:** ${new Date().toLocaleDateString("pt-PT")}

## 1. Identificação do Prestador
**${legalName}**, NIF ${nif}  
Sede: ${address}  
Contacto: ${email} | ${phone}  
Website: ${website}

## 2. Objeto
Estes termos regulam o acesso e utilização dos serviços prestados por ${name}.

## 3. Aceitação
A utilização dos serviços implica a aceitação plena destes termos.

## 4. Serviços
${name} fornece serviços de marketing digital e gestão empresarial através da sua plataforma online.

## 5. Obrigações do Utilizador
O utilizador compromete-se a:
- Fornecer informações verdadeiras
- Não utilizar os serviços para fins ilícitos
- Manter a confidencialidade das suas credenciais

## 6. Propriedade Intelectual
Todo o conteúdo da plataforma é propriedade de ${legalName}.

## 7. Responsabilidade
${name} não se responsabiliza por danos indiretos decorrentes da utilização dos serviços.

## 8. Lei Aplicável
Estes termos são regidos pela lei portuguesa. Foro: Comarca de ${data.city || "Lisboa"}.

## 9. Livro de Reclamações
Disponível em: ${complaints}

---
${name} | ${website}`;
  }

  // cookies
  return `# Política de Cookies — ${name}

**Última atualização:** ${new Date().toLocaleDateString("pt-PT")}

## 1. O que são Cookies?
Cookies são pequenos ficheiros de texto armazenados no dispositivo do utilizador durante a navegação.

## 2. Responsável
**${legalName}**, NIF ${nif} — ${email}

## 3. Tipos de Cookies Utilizados

| Tipo | Finalidade | Duração |
|------|-----------|---------|
| Essenciais | Funcionamento do site | Sessão |
| Analíticos | Estatísticas de utilização | 13 meses |
| Marketing | Publicidade personalizada | 6 meses |

## 4. Gestão de Cookies
Pode gerir as preferências de cookies através do banner de consentimento ou nas definições do browser.

## 5. Cookies de Terceiros
Utilizamos serviços de terceiros que podem instalar cookies:
- Google Analytics
- Meta Pixel

## 6. Mais Informações
Contacte-nos: ${email} | ${phone}

---
${name} | ${website}`;
}

export default function LegalPagesTab() {
  const { user } = useAuth();
  const [businessData, setBusinessData] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PageType | null>(null);
  const [activePreview, setActivePreview] = useState<PageType>("privacidade");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("business_profiles" as string)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        const d = data as Record<string, unknown>;
        setBusinessData({
          legal_name: (d.legal_name as string) || "",
          trade_name: (d.trade_name as string) || "",
          nif: (d.nif as string) || "",
          address_line1: (d.address_line1 as string) || "",
          postal_code: (d.postal_code as string) || "",
          city: (d.city as string) || "",
          country: (d.country as string) || "",
          email: (d.email as string) || "",
          phone: (d.phone as string) || "",
          website: (d.website as string) || "",
          complaints_book_url: (d.complaints_book_url as string) || "",
        });
      } else {
        setBusinessData({
          legal_name: "", trade_name: "", nif: "", address_line1: "",
          postal_code: "", city: "", country: "Portugal", email: "",
          phone: "", website: "", complaints_book_url: "",
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const missingFields = businessData
    ? ["legal_name", "nif", "email"].filter((f) => !(businessData as Record<string, string>)[f])
    : [];

  async function handleSave(type: PageType) {
    if (!user || !businessData) return;
    setSaving(type);

    const content = generateTemplate(type, businessData);

    const { error } = await supabase.from("compliance_pages" as string).upsert(
      {
        user_id: user.id,
        page_type: type,
        content,
        status: "validated",
        validated_at: new Date().toISOString(),
      } as Record<string, unknown>,
      { onConflict: "user_id,page_type" }
    );

    if (error) {
      // If upsert with onConflict fails (no unique constraint), try delete+insert
      await supabase.from("compliance_pages" as string).delete().eq("user_id", user.id).eq("page_type", type);
      const { error: insertError } = await supabase.from("compliance_pages" as string).insert({
        user_id: user.id,
        page_type: type,
        content,
        status: "validated",
        validated_at: new Date().toISOString(),
      } as Record<string, unknown>);

      if (insertError) {
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível guardar a página." });
      } else {
        toast({ title: "Página guardada ✅", description: `${PAGE_LABELS[type]} gerada e guardada.` });
      }
    } else {
      toast({ title: "Página guardada ✅", description: `${PAGE_LABELS[type]} gerada e guardada.` });
    }
    setSaving(null);
  }

  if (loading) {
    return <div className="h-48 animate-pulse bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      {missingFields.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Dados em falta</p>
              <p className="text-xs text-muted-foreground mt-1">
                Preenche os <strong>Dados da Empresa</strong> (Nome Legal, NIF, Email) para gerar documentos legais completos. Os campos em falta aparecerão como placeholders.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activePreview} onValueChange={(v) => setActivePreview(v as PageType)}>
        <TabsList className="w-full">
          {(Object.keys(PAGE_LABELS) as PageType[]).map((type) => (
            <TabsTrigger key={type} value={type} className="flex-1">
              {PAGE_LABELS[type]}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(PAGE_LABELS) as PageType[]).map((type) => (
          <TabsContent key={type} value={type}>
            <Card className="glass">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5 text-primary" />
                    {PAGE_LABELS[type]}
                  </CardTitle>
                  <CardDescription>Pré-visualização com os dados da empresa</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Eye className="h-3 w-3" />
                    Preview
                  </Badge>
                  <Button
                    size="sm"
                    onClick={() => handleSave(type)}
                    disabled={saving === type}
                  >
                    {saving === type ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Guardar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 bg-background/50 max-h-[500px] overflow-y-auto">
                  {businessData && renderMarkdown(generateTemplate(type, businessData))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/** Simple markdown-to-JSX renderer for legal docs */
function renderMarkdown(md: string) {
  const lines = md.split("\n");
  const elements: React.ReactNode[] = [];
  let tableRows: string[][] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table row
    if (line.startsWith("|")) {
      const cells = line.split("|").filter(Boolean).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) continue; // separator
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(cells);
      // Check if next line is not a table
      if (i + 1 >= lines.length || !lines[i + 1].startsWith("|")) {
        elements.push(
          <div key={i} className="overflow-x-auto my-4">
            <table className="w-full text-sm">
              <thead>
                <tr>{tableRows[0]?.map((c, j) => <th key={j} className="border px-3 py-2 text-left font-medium bg-muted/50">{c}</th>)}</tr>
              </thead>
              <tbody>
                {tableRows.slice(1).map((row, ri) => (
                  <tr key={ri}>{row.map((c, j) => <td key={j} className="border px-3 py-2">{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        inTable = false;
        tableRows = [];
      }
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-xl font-bold mb-4">{line.slice(2)}</h1>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-lg font-semibold mt-6 mb-2">{line.slice(3)}</h2>);
    } else if (line.startsWith("- ")) {
      elements.push(<li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>);
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="my-4" />);
    } else if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(<p key={i} className="font-semibold text-sm">{line.slice(2, -2)}</p>);
    } else if (line.trim()) {
      elements.push(<p key={i} className="text-sm mb-2">{formatInline(line)}</p>);
    }
  }

  return <>{elements}</>;
}

function formatInline(text: string): React.ReactNode {
  // Bold
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
