import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { FileText, Eye, Save, Loader2, AlertTriangle, Printer, Pencil, Lock, RotateCcw, RefreshCw, Building2 } from "lucide-react";
import { Link } from "react-router-dom";

interface BusinessData {
  legal_name: string;
  business_name: string;
  nif: string;
  address_line1: string;
  postal_code: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  website: string;
}

type BusinessSource = Partial<BusinessData> & {
  trade_name?: string | null;
  name?: string | null;
  company_name?: string | null;
  contact_email?: string | null;
  full_name?: string | null;
};

type PageType = "privacidade" | "termos" | "cookies";

const PAGE_LABELS: Record<PageType, string> = {
  privacidade: "Política de Privacidade",
  termos: "Termos e Condições",
  cookies: "Política de Cookies",
};

const LEGAL_COMPLIANCE_PAGE_TYPES: Record<PageType, string> = {
  privacidade: "privacy_policy",
  termos: "terms_conditions",
  cookies: "cookie_policy",
};

const cleanValue = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const getLegalMarkdown = (content: unknown): string | null => {
  const record = asRecord(content);
  return typeof record.legal_markdown === "string" ? record.legal_markdown : null;
};

function firstFilled(sources: BusinessSource[], keys: (keyof BusinessSource)[]): string {
  for (const source of sources) {
    for (const key of keys) {
      const value = cleanValue(source[key]);
      if (value) return value;
    }
  }
  return "";
}

function normalizeBusinessData(sources: BusinessSource[], userEmail?: string): BusinessData {
  return {
    legal_name: firstFilled(sources, ["legal_name", "company_name", "full_name"]),
    business_name: firstFilled(sources, ["trade_name", "business_name", "name", "company_name", "legal_name"]),
    nif: firstFilled(sources, ["nif"]),
    address_line1: firstFilled(sources, ["address_line1"]),
    postal_code: firstFilled(sources, ["postal_code"]),
    city: firstFilled(sources, ["city"]),
    country: firstFilled(sources, ["country"]) || "Portugal",
    email: firstFilled(sources, ["email", "contact_email"]) || userEmail || "",
    phone: firstFilled(sources, ["phone"]),
    website: firstFilled(sources, ["website"]),
  };
}


function generatePrivacy(d: BusinessData): string {
  const name = d.business_name || d.legal_name || "[Nome da Empresa]";
  const legalName = d.legal_name || "[Denominação Social]";
  const nif = d.nif || "[NIF]";
  const address = [d.address_line1, d.postal_code, d.city, d.country].filter(Boolean).join(", ") || "[Morada]";
  const email = d.email || "[email]";
  const phone = d.phone || "[telefone]";
  const website = d.website || "[website]";
  const complaints = "https://www.livroreclamacoes.pt";

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

function generateTerms(d: BusinessData): string {
  const name = d.business_name || d.legal_name || "[Nome da Empresa]";
  const legalName = d.legal_name || "[Denominação Social]";
  const nif = d.nif || "[NIF]";
  const address = [d.address_line1, d.postal_code, d.city, d.country].filter(Boolean).join(", ") || "[Morada]";
  const email = d.email || "[email]";
  const phone = d.phone || "[telefone]";
  const website = d.website || "[website]";
  const complaints = "https://www.livroreclamacoes.pt";

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
${name} fornece serviços através do seu website e canais de comunicação oficiais.

## 5. Obrigações do Utilizador
O utilizador compromete-se a:
- Fornecer informações verdadeiras
- Não utilizar os serviços para fins ilícitos
- Manter a confidencialidade das suas credenciais

## 6. Propriedade Intelectual
Todo o conteúdo é propriedade de ${legalName}.

## 7. Responsabilidade
${name} não se responsabiliza por danos indiretos decorrentes da utilização dos serviços.

## 8. Lei Aplicável
Estes termos são regidos pela lei portuguesa. Foro: Comarca de ${d.city || "Lisboa"}.

## 9. Livro de Reclamações
Disponível em: ${complaints}

---
${name} | ${website}`;
}

/** Política de Cookies fixa — descreve as cookies que a APP (Nexus Machine) utiliza nas suas ferramentas. Não editável pelo utilizador. */
function generateCookies(d: BusinessData): string {
  const name = d.business_name || d.legal_name || "o website";
  return `# Política de Cookies — ${name}

**Última atualização:** ${new Date().toLocaleDateString("pt-PT")}

Este website utiliza ferramentas da plataforma **Nexus Machine** (Web Business / Astrolábio Mágico Investimentos LDA) para funcionar, medir performance e otimizar a experiência do utilizador. Esta política descreve as cookies efetivamente instaladas pelas ferramentas técnicas da plataforma.

## 1. O que são Cookies?
Cookies são pequenos ficheiros de texto armazenados no dispositivo do utilizador durante a navegação, utilizados para garantir o funcionamento do site, recordar preferências e recolher estatísticas anónimas.

## 2. Cookies Essenciais (sempre ativas)

| Nome | Origem | Finalidade | Duração |
|------|--------|-----------|---------|
| sb-access-token | Supabase (Nexus) | Autenticação e sessão do utilizador | Sessão |
| sb-refresh-token | Supabase (Nexus) | Renovação segura de sessão | 7 dias |
| nx_consent | Nexus Machine | Memoriza a escolha de consentimento de cookies | 12 meses |

## 3. Cookies Analíticas (sujeitas a consentimento)

| Nome | Origem | Finalidade | Duração |
|------|--------|-----------|---------|
| _ga | Google Analytics 4 | Distinguir utilizadores únicos | 13 meses |
| _ga_* | Google Analytics 4 | Persistência do estado da sessão GA4 | 13 meses |
| _gid | Google Analytics | Distinguir utilizadores | 24 horas |

## 4. Cookies de Marketing (sujeitas a consentimento)

| Nome | Origem | Finalidade | Duração |
|------|--------|-----------|---------|
| _fbp | Meta Pixel | Atribuição de campanhas e remarketing | 3 meses |
| fr | Facebook | Entrega de anúncios e medição | 3 meses |
| IDE | Google Ads | Medição de conversões e remarketing | 13 meses |

## 5. Gestão de Cookies
Pode aceitar, rejeitar ou alterar a sua escolha em qualquer momento através do banner de consentimento apresentado no site, ou nas definições do seu browser. A rejeição das cookies analíticas e de marketing não impede a utilização do site, apenas limita a personalização e a medição.

## 6. Cookies de Terceiros
Os serviços de terceiros utilizados (Google, Meta, Supabase) podem processar dados fora do EEE ao abrigo das Cláusulas Contratuais Tipo da Comissão Europeia.

## 7. Mais Informações
Para esclarecimentos sobre esta política de cookies, contacte o responsável pelo tratamento indicado na Política de Privacidade.

---
Esta política descreve a configuração técnica padrão das ferramentas Nexus Machine e não pode ser editada pelo cliente, sendo gerida centralmente para garantir conformidade RGPD.`;
}

function generateTemplate(type: PageType, data: BusinessData): string {
  if (type === "privacidade") return generatePrivacy(data);
  if (type === "termos") return generateTerms(data);
  return generateCookies(data);
}

export default function LegalPagesTab() {
  const { user } = useAuth();
  const [businessData, setBusinessData] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<PageType | null>(null);
  const [activePreview, setActivePreview] = useState<PageType>("privacidade");
  const [editing, setEditing] = useState<Record<PageType, boolean>>({ privacidade: false, termos: false, cookies: false });
  const [drafts, setDrafts] = useState<Record<PageType, string | null>>({ privacidade: null, termos: null, cookies: null });
  const printRef = useRef<HTMLDivElement>(null);

  const loadBusinessData = async () => {
    if (!user) return;
    // Use select("*") to survive any schema variation between dev and prod.
    const [businessProfiles, projects, profiles] = await Promise.all([
      supabase.from("business_profiles").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(5),
      supabase.from("projects").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(5),
      supabase.from("profiles").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1),
    ]);

    const sources = [
      ...((businessProfiles.data || []) as BusinessSource[]),
      ...((projects.data || []) as BusinessSource[]),
      ...((profiles.data || []) as BusinessSource[]),
    ];

    console.info("[LegalPagesTab] Sources fetched:", {
      business_profiles: businessProfiles.data?.length || 0,
      projects: projects.data?.length || 0,
      profiles: profiles.data?.length || 0,
      bp_error: businessProfiles.error?.message,
      proj_error: projects.error?.message,
    });

    const normalized = normalizeBusinessData(sources, user.email || "");
    setBusinessData(normalized);

    // Load saved legal pages from the compliance table that exists in production.
    const legalPageTypes = Object.values(LEGAL_COMPLIANCE_PAGE_TYPES);
    const { data: pages } = await supabase
      .from("compliance_pages")
      .select("page_type, content")
      .eq("user_id", user.id)
      .in("page_type", legalPageTypes);

    if (pages?.length) {
      const next: Record<PageType, string | null> = { privacidade: null, termos: null, cookies: null };
      for (const row of pages as Array<{ page_type: string; content: unknown }>) {
        const type = (Object.keys(LEGAL_COMPLIANCE_PAGE_TYPES) as PageType[]).find((key) => LEGAL_COMPLIANCE_PAGE_TYPES[key] === row.page_type);
        if (type) next[type] = typeof row.content === "string" ? row.content : getLegalMarkdown(row.content);
      }
      setDrafts(next);
    }
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    loadBusinessData().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBusinessData();
    setRefreshing(false);
    toast({ title: "Dados atualizados ✅", description: "Recolhidos do perfil da empresa." });
  };

  const missingFields = useMemo(() => {
    if (!businessData) return [];
    const map: Record<string, string> = {
      legal_name: "Nome Legal",
      nif: "NIF",
      email: "Email",
      phone: "Telefone",
      address_line1: "Morada",
    };
    return Object.entries(map)
      .filter(([k]) => !(businessData as unknown as Record<string, string>)[k])
      .map(([, label]) => label);
  }, [businessData]);

  const contentFor = (type: PageType): string => {
    if (!businessData) return "";
    if (type === "cookies") return generateCookies(businessData); // always fixed
    return drafts[type] ?? generateTemplate(type, businessData);
  };

  async function handleSave(type: PageType) {
    if (!user || !businessData || type === "cookies") return;
    setSaving(type);
    const content = drafts[type] ?? generateTemplate(type, businessData);
    const pageType = LEGAL_COMPLIANCE_PAGE_TYPES[type];

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!project?.id) {
      toast({ variant: "destructive", title: "Erro ao guardar", description: "Não foi encontrado um projeto para associar esta página." });
      setSaving(null);
      return;
    }

    const { data: existing, error: lookupError } = await supabase
      .from("compliance_pages")
      .select("id, custom_fields")
      .eq("user_id", user.id)
      .eq("project_id", project.id)
      .eq("page_type", pageType)
      .maybeSingle();

    let error: unknown = lookupError;
    if (existing?.id) {
      const existingFields = asRecord(existing.custom_fields);
      const r = await supabase
        .from("compliance_pages")
        .update({
          status: "validated",
          content,
          custom_fields: { ...existingFields, title: PAGE_LABELS[type], legal_updated_at: new Date().toISOString() },
          validated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      error = r.error;
    } else if (!error) {
      const r = await supabase
        .from("compliance_pages")
        .insert({
          user_id: user.id,
          project_id: project.id,
          page_type: pageType,
          status: "validated",
          content,
          custom_fields: { title: PAGE_LABELS[type], legal_updated_at: new Date().toISOString() },
          validated_at: new Date().toISOString(),
        });
      error = r.error;
    }

    if (error) {
      console.error("[LegalPagesTab] Save error:", error);
      const msg =
        (error as { message?: string })?.message ||
        (typeof error === "string" ? error : "Não foi possível guardar a página.");
      toast({ variant: "destructive", title: "Erro ao guardar", description: msg });
    } else {
      toast({ title: "Página guardada ✅", description: `${PAGE_LABELS[type]} atualizada.` });
      setEditing((s) => ({ ...s, [type]: false }));
    }
    setSaving(null);
  }

  function handleResetToTemplate(type: PageType) {
    if (!businessData) return;
    setDrafts((s) => ({ ...s, [type]: generateTemplate(type, businessData) }));
  }

  function handlePrint(type: PageType) {
    const content = contentFor(type);
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${PAGE_LABELS[type]}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;color:#111;line-height:1.55;}
  h1{font-size:24px;border-bottom:2px solid #111;padding-bottom:8px;}
  h2{font-size:16px;margin-top:24px;}
  table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13px;}
  th,td{border:1px solid #999;padding:6px 10px;text-align:left;}
  th{background:#f3f3f3;}
  hr{margin:24px 0;border:none;border-top:1px solid #ddd;}
  ul{padding-left:20px;}
</style></head><body>${markdownToHtml(content)}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  if (loading) {
    return <div className="h-48 animate-pulse bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      {/* Dados detetados — transparência ao utilizador */}
      <Card className="glass border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-primary" />
              Dados recolhidos do Perfil da Empresa
            </CardTitle>
            <CardDescription>
              Estes dados são usados nos documentos legais. Para alterar, edita em{" "}
              <Link to="/settings" className="text-primary underline">Dados da Empresa</Link>.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {[
            { label: "Denominação Social", value: businessData?.legal_name },
            { label: "NIF", value: businessData?.nif },
            { label: "Telefone", value: businessData?.phone },
            { label: "Email", value: businessData?.email },
            { label: "Morada", value: [businessData?.address_line1, businessData?.postal_code, businessData?.city].filter(Boolean).join(", ") },
            { label: "Website", value: businessData?.website },
          ].map((item) => (
            <div key={item.label} className="flex justify-between gap-2 border-b border-border/40 py-1">
              <span className="text-muted-foreground">{item.label}:</span>
              <span className={item.value ? "font-medium text-foreground text-right" : "italic text-muted-foreground/60"}>
                {item.value || "— em falta —"}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {missingFields.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Dados em falta nos Dados da Empresa</p>
              <p className="text-xs text-muted-foreground mt-1">
                Faltam: <strong>{missingFields.join(", ")}</strong>. Preenche em{" "}
                <Link to="/settings" className="underline text-primary">Dados da Empresa</Link>{" "}
                e clica em <em>Atualizar</em>. Podes na mesma editar e imprimir abaixo — a responsabilidade legal é da empresa contratante.
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

        {(Object.keys(PAGE_LABELS) as PageType[]).map((type) => {
          const isCookies = type === "cookies";
          const isEditing = editing[type];
          const content = contentFor(type);

          return (
            <TabsContent key={type} value={type}>
              <Card className="glass">
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5 text-primary" />
                      {PAGE_LABELS[type]}
                    </CardTitle>
                    <CardDescription>
                      {isCookies
                        ? "Política técnica fixa — gerida pela Nexus Machine para garantir conformidade RGPD."
                        : "A responsabilidade legal é da empresa contratante. Podes editar livremente."}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isCookies ? (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="h-3 w-3" /> Não editável
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <Eye className="h-3 w-3" /> {isEditing ? "A editar" : "Preview"}
                      </Badge>
                    )}

                    {!isCookies && (
                      <>
                        {!isEditing ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDrafts((s) => ({ ...s, [type]: s[type] ?? content }));
                              setEditing((s) => ({ ...s, [type]: true }));
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-1" /> Editar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResetToTemplate(type)}
                            title="Repor template original"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" /> Repor
                          </Button>
                        )}
                        <Button size="sm" onClick={() => handleSave(type)} disabled={saving === type}>
                          {saving === type ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                          Guardar
                        </Button>
                      </>
                    )}

                    <Button size="sm" variant="outline" onClick={() => handlePrint(type)}>
                      <Printer className="h-4 w-4 mr-1" /> Imprimir
                    </Button>
                  </div>
                </CardHeader>

                <CardContent>
                  {isEditing && !isCookies ? (
                    <Textarea
                      value={drafts[type] ?? content}
                      onChange={(e) => setDrafts((s) => ({ ...s, [type]: e.target.value }))}
                      className="min-h-[500px] font-mono text-xs"
                    />
                  ) : (
                    <div ref={printRef} className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 bg-background/50 max-h-[500px] overflow-y-auto">
                      {renderMarkdown(content)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
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

    if (line.startsWith("|")) {
      const cells = line.split("|").filter(Boolean).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) continue;
      if (!inTable) { inTable = true; tableRows = []; }
      tableRows.push(cells);
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
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

/** Lightweight markdown -> HTML for the print window */
function markdownToHtml(md: string): string {
  const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  const lines = md.split("\n");
  const out: string[] = [];
  let tableRows: string[][] = [];
  let inTable = false;
  let inList = false;

  const flushList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  const flushTable = () => {
    if (!inTable) return;
    out.push('<table>');
    tableRows.forEach((row, idx) => {
      const tag = idx === 0 ? "th" : "td";
      out.push("<tr>" + row.map((c) => `<${tag}>${escape(c)}</${tag}>`).join("") + "</tr>");
    });
    out.push("</table>");
    inTable = false;
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("|")) {
      const cells = line.split("|").filter(Boolean).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) continue;
      if (!inTable) { inTable = true; tableRows = []; flushList(); }
      tableRows.push(cells);
      if (i + 1 >= lines.length || !lines[i + 1].startsWith("|")) flushTable();
      continue;
    }
    flushTable();

    if (line.startsWith("# ")) { flushList(); out.push(`<h1>${escape(line.slice(2))}</h1>`); }
    else if (line.startsWith("## ")) { flushList(); out.push(`<h2>${escape(line.slice(3))}</h2>`); }
    else if (line.startsWith("- ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inlineHtml(escape(line.slice(2)))}</li>`);
    }
    else if (line.startsWith("---")) { flushList(); out.push("<hr/>"); }
    else if (line.trim()) { flushList(); out.push(`<p>${inlineHtml(escape(line))}</p>`); }
  }
  flushList();
  flushTable();
  return out.join("\n");
}

function inlineHtml(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
