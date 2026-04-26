import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { useProjectData } from "@/hooks/useProjectData";
import { supabase } from "@/lib/supabaseCustom";

interface PageSEO {
  title?: string;
  description?: string;
}

export function DynamicSEOHead() {
  const { project, profile } = useProjectData();
  const [pageSeo, setPageSeo] = useState<PageSEO | null>(null);

  // Carrega SEO da home page (slug=home) — gerado pelo botão "Publicar"
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("pages")
        .select("content")
        .eq("project_id", project.id)
        .eq("slug", "home")
        .eq("is_published", true)
        .maybeSingle();
      if (cancelled) return;
      const content = (data?.content && typeof data.content === "object")
        ? (data.content as Record<string, unknown>)
        : {};
      const seo = (content.seo && typeof content.seo === "object")
        ? (content.seo as PageSEO)
        : null;
      if (seo) setPageSeo(seo);
    })();
    return () => { cancelled = true; };
  }, [project?.id]);

  const companyName = profile?.company_name || "Nexus Machine";
  const domain = project?.domain || "";

  const title = pageSeo?.title || `${companyName} — O Teu Negócio Online`;
  const description = pageSeo?.description
    || `${companyName}: Descobre o que temos para ti e contacta-nos hoje.`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title.length > 60 ? title.slice(0, 57) + "..." : title}</title>
      <meta
        name="description"
        content={description.length > 160 ? description.slice(0, 157) + "..." : description}
      />

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
