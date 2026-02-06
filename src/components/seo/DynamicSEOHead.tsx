import { Helmet } from "react-helmet-async";
import { useProjectData } from "@/hooks/useProjectData";

const SECTOR_KEYWORDS: Record<string, string> = {
  cafetaria: "cafetaria, café, pastelaria, menu do dia",
  restaurante: "restaurante, menu, gastronomia, reservas",
  imobiliaria: "imobiliária, imóveis, casas, apartamentos",
  advocacia: "advocacia, advogado, jurídico, consultoria legal",
  salao_beleza: "salão de beleza, estética, cabeleireiro, manicure",
  fitness: "fitness, ginásio, treino, personal trainer",
  loja_roupa: "moda, roupa, loja online, vestuário",
  clinica: "clínica, saúde, consultas, médico",
};

export function DynamicSEOHead() {
  const { project, profile } = useProjectData();

  const companyName = profile?.company_name || "Nexus AI";
  const sector = profile?.business_sector || "";
  const domain = project?.domain || "";

  const sectorKeywords = SECTOR_KEYWORDS[sector] || "";
  const title = `${companyName} — ${sector ? sectorKeywords.split(",")[0].trim() : "O Teu Negócio Online"}`;
  const description = `${companyName}: A melhor experiência em ${sectorKeywords.split(",")[0]?.trim() || "serviços"}. Descobre o que temos para ti e contacta-nos hoje.`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title.length > 60 ? title.slice(0, 57) + "..." : title}</title>
      <meta
        name="description"
        content={description.length > 160 ? description.slice(0, 157) + "..." : description}
      />
      {sectorKeywords && <meta name="keywords" content={sectorKeywords} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {domain && <meta property="og:url" content={domain} />}
      <meta property="og:site_name" content={companyName} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />

      {/* Canonical */}
      {domain && <link rel="canonical" href={domain} />}
    </Helmet>
  );
}
