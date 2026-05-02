// Shared legal templates used by Settings/Legal AND auto-seeded by the Site Builder.
// Mirrors the templates in src/components/settings/LegalPagesTab.tsx so the
// privacy/terms/cookie pages displayed on the published site are populated with
// real business data (no generic placeholders).

export interface LegalBusinessData {
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

export const EMPTY_LEGAL_DATA: LegalBusinessData = {
  legal_name: "",
  business_name: "",
  nif: "",
  address_line1: "",
  postal_code: "",
  city: "",
  country: "Portugal",
  email: "",
  phone: "",
  website: "",
};

export type LegalPageKey = "privacidade" | "termos" | "cookies";

export const LEGAL_PAGE_TYPE_MAP: Record<LegalPageKey, string> = {
  privacidade: "privacy_policy",
  termos: "terms_conditions",
  cookies: "cookie_policy",
};

export const LEGAL_PAGE_LABELS: Record<LegalPageKey, string> = {
  privacidade: "Política de Privacidade",
  termos: "Termos e Condições",
  cookies: "Política de Cookies",
};

export function generatePrivacy(d: LegalBusinessData): string {
  const name = d.business_name || d.legal_name || "[Nome da Empresa]";
  const legalName = d.legal_name || "[Denominação Social]";
  const nif = d.nif || "[NIF]";
  const address =
    [d.address_line1, d.postal_code, d.city, d.country].filter(Boolean).join(", ") || "[Morada]";
  const email = d.email || "[email]";
  const phone = d.phone || "[telefone]";
  const website = d.website || "[website]";

  return `# Política de Privacidade — ${name}

**Última atualização:** ${new Date().toLocaleDateString("pt-PT")}

## 1. Responsável pelo Tratamento
**${legalName}**, NIF ${nif}, com sede em ${address}.  
Contacto: ${email} | ${phone}

## 2. Dados Recolhidos
- Nome e apelido
- Endereço de email
- Número de telefone
- Dados de navegação (cookies)

## 3. Finalidade do Tratamento
- Prestação dos serviços contratados
- Comunicações comerciais (com consentimento)
- Cumprimento de obrigações legais

## 4. Base Legal
Tratamento ao abrigo do RGPD Art. 6.º (consentimento, contrato e obrigação legal).

## 5. Conservação dos Dados
Pelo período necessário à finalidade e por períodos adicionais exigidos por lei.

## 6. Direitos do Titular
Acesso, retificação, apagamento, portabilidade e oposição via ${email}.

## 7. Autoridade de Controlo
Reclamações à CNPD — Comissão Nacional de Proteção de Dados.

## 8. Livro de Reclamações
Disponível em: https://www.livroreclamacoes.pt

---
${name} | ${website}`;
}

export function generateTerms(d: LegalBusinessData): string {
  const name = d.business_name || d.legal_name || "[Nome da Empresa]";
  const legalName = d.legal_name || "[Denominação Social]";
  const nif = d.nif || "[NIF]";
  const address =
    [d.address_line1, d.postal_code, d.city, d.country].filter(Boolean).join(", ") || "[Morada]";
  const email = d.email || "[email]";
  const phone = d.phone || "[telefone]";
  const website = d.website || "[website]";

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
- Fornecer informações verdadeiras
- Não utilizar os serviços para fins ilícitos
- Manter a confidencialidade das suas credenciais

## 6. Propriedade Intelectual
Todo o conteúdo é propriedade de ${legalName}.

## 7. Responsabilidade
${name} não se responsabiliza por danos indiretos decorrentes da utilização.

## 8. Lei Aplicável
Lei portuguesa. Foro: Comarca de ${d.city || "Lisboa"}.

## 9. Livro de Reclamações
https://www.livroreclamacoes.pt

---
${name} | ${website}`;
}

export function generateCookies(d: LegalBusinessData): string {
  const name = d.business_name || d.legal_name || "o website";
  return `# Política de Cookies — ${name}

**Última atualização:** ${new Date().toLocaleDateString("pt-PT")}

Este website utiliza cookies para garantir o seu funcionamento, medir performance e otimizar a experiência do utilizador.

## 1. O que são Cookies?
Pequenos ficheiros guardados no dispositivo durante a navegação.

## 2. Cookies Essenciais
Necessárias ao funcionamento (sessão, segurança). Sempre ativas.

## 3. Cookies Analíticas (sujeitas a consentimento)
Google Analytics 4 (_ga, _ga_*) — medição agregada de tráfego.

## 4. Cookies de Marketing (sujeitas a consentimento)
Meta Pixel (_fbp, fr) e Google Ads (IDE) — atribuição e remarketing.

## 5. Gestão de Cookies
Pode aceitar, rejeitar ou alterar a sua escolha no banner de consentimento ou nas definições do browser.

## 6. Mais Informações
Para esclarecimentos, contacte o responsável indicado na Política de Privacidade.

---
${name}`;
}

export function generateLegalTemplate(type: LegalPageKey, data: LegalBusinessData): string {
  if (type === "privacidade") return generatePrivacy(data);
  if (type === "termos") return generateTerms(data);
  return generateCookies(data);
}

const cleanValue = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

function firstFilled(
  sources: Array<Record<string, unknown>>,
  keys: string[],
): string {
  for (const source of sources) {
    for (const key of keys) {
      const v = cleanValue(source[key]);
      if (v) return v;
    }
  }
  return "";
}

export function normalizeLegalBusinessData(
  sources: Array<Record<string, unknown>>,
  userEmail?: string,
): LegalBusinessData {
  return {
    legal_name: firstFilled(sources, ["legal_name", "company_name", "full_name"]),
    business_name: firstFilled(sources, [
      "trade_name",
      "business_name",
      "name",
      "company_name",
      "legal_name",
    ]),
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
