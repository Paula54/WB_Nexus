import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import type { WebsiteSection } from "@/types/nexus";
import {
  LEGAL_PAGE_LABELS,
  LEGAL_PAGE_TYPE_MAP,
  type LegalPageKey,
  generateLegalTemplate,
  normalizeLegalBusinessData,
} from "@/lib/legalTemplates";

/**
 * DynamicPageRenderer
 * -------------------
 * Renderiza dinamicamente uma página de site Nexus a partir do Supabase.
 *
 * Fontes de dados (sempre filtradas por user_id via RLS):
 *  - projects             → branding, nome do negócio, domínio
 *  - business_profiles    → identidade fiscal, contactos, redes sociais, logo
 *  - pages                → menu de navegação (multi-página)
 *  - page_sections        → conteúdo de cada página (hero, features, cta, etc.)
 *
 * SEO:
 *  - Reserva <title> e <meta name="description"> via react-helmet-async,
 *    lendo de pages.content.seo (preenchido pela Edge Function auto-generate-meta-tags).
 */

interface BrandingData {
  site_title: string;
  company_name: string;
  logo_url: string | null;
  primary_color: string;
  email: string | null;
  phone: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  legal_name: string | null;
}

interface PageMeta {
  id: string;
  title: string;
  slug: string;
  is_published: boolean;
  sort_order: number;
  seo_title?: string;
  seo_description?: string;
  legal_markdown?: string;
}

const LEGAL_SLUGS: Record<string, LegalPageKey> = {
  privacidade: "privacidade",
  privacy: "privacidade",
  termos: "termos",
  terms: "termos",
  cookies: "cookies",
};

function renderLegalMarkdown(markdown: string) {
  return markdown.split("\n").map((line, index) => {
    if (line.startsWith("# ")) return <h1 key={index} className="text-3xl font-bold mb-6">{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={index} className="text-xl font-semibold mt-8 mb-3">{line.slice(3)}</h2>;
    if (line.startsWith("- ")) return <li key={index} className="ml-6 list-disc text-muted-foreground">{line.slice(2)}</li>;
    if (line.startsWith("---")) return <hr key={index} className="my-6 border-border" />;
    if (!line.trim()) return null;
    return <p key={index} className="mb-3 text-muted-foreground leading-relaxed">{line.replace(/\*\*/g, "")}</p>;
  });
}

interface DynamicPageRendererProps {
  /** Slug da página a renderizar. Se omitido, usa o param da URL ou "home". */
  slug?: string;
  /** Permite forçar um user_id específico (modo preview admin). Por defeito usa o utilizador autenticado. */
  ownerUserId?: string;
}

export function DynamicPageRenderer({ slug: slugProp, ownerUserId }: DynamicPageRendererProps) {
  const { user } = useAuth();
  const params = useParams<{ slug?: string }>();
  const targetSlug = slugProp ?? params.slug ?? "home";

  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<BrandingData | null>(null);
  const [pages, setPages] = useState<PageMeta[]>([]);
  const [currentPage, setCurrentPage] = useState<PageMeta | null>(null);
  const [sections, setSections] = useState<WebsiteSection[]>([]);

  const effectiveUserId = ownerUserId ?? user?.id ?? null;

  useEffect(() => {
    if (!effectiveUserId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      setLoading(true);

      // 1. Project (branding base) — RLS filtra por user_id
      const { data: project } = await supabase
        .from("projects")
        .select(
          "id, name, logo_url, email, phone, facebook_url, instagram_url, linkedin_url, legal_name, trade_name, business_name"
        )
        .eq("user_id", effectiveUserId!)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!project) {
        if (!cancelled) setLoading(false);
        return;
      }

      // 2. Business Profile (identidade fiscal complementar)
      const { data: bp } = await supabase
        .from("business_profiles")
        .select("legal_name, trade_name, logo_url, email, phone, facebook_url, instagram_url, linkedin_url")
        .eq("user_id", effectiveUserId!)
        .maybeSingle();

      const composedBranding: BrandingData = {
        site_title: bp?.trade_name || project.business_name || project.name || "O Meu Negócio",
        company_name: bp?.legal_name || project.legal_name || project.name || "",
        logo_url: bp?.logo_url || project.logo_url || null,
        primary_color: "hsl(var(--primary))",
        email: bp?.email || project.email || null,
        phone: bp?.phone || project.phone || null,
        facebook_url: bp?.facebook_url || project.facebook_url || null,
        instagram_url: bp?.instagram_url || project.instagram_url || null,
        linkedin_url: bp?.linkedin_url || project.linkedin_url || null,
        legal_name: bp?.legal_name || project.legal_name || null,
      };

      const legalKey = LEGAL_SLUGS[targetSlug];
      if (legalKey) {
        const legalData = normalizeLegalBusinessData(
          [
            (bp || {}) as Record<string, unknown>,
            (project || {}) as Record<string, unknown>,
          ],
          composedBranding.email || undefined,
        );
        const generatedLegalPage: PageMeta = {
          id: `legal-${legalKey}`,
          title: LEGAL_PAGE_LABELS[legalKey],
          slug: targetSlug,
          is_published: true,
          sort_order: 999,
          legal_markdown: generateLegalTemplate(legalKey, legalData),
        };
        if (!cancelled) {
          setBranding(composedBranding);
          setPages([]);
          setCurrentPage(generatedLegalPage);
          setSections([]);
          setLoading(false);
        }
        return;
      }

      // 3. Pages (menu dinâmico — multi-página Growth/OS)
      const { data: pagesRows } = await supabase
        .from("pages")
        .select("id, title, slug, is_published, sort_order, content")
        .eq("project_id", project.id)
        .order("sort_order", { ascending: true });

      const pageList: PageMeta[] = (pagesRows ?? []).map((p) => {
        const seo = (p.content as { seo?: { title?: string; description?: string } } | null)?.seo;
        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          is_published: p.is_published,
          sort_order: p.sort_order,
          seo_title: seo?.title,
          seo_description: seo?.description,
          legal_markdown: typeof (p.content as { legal_markdown?: unknown } | null)?.legal_markdown === "string"
            ? (p.content as { legal_markdown: string }).legal_markdown
            : undefined,
        };
      });

      const active =
        pageList.find((p) => p.slug === targetSlug) ??
        pageList.find((p) => p.slug === "home") ??
        pageList[0] ??
        null;

      // 4. Sections da página ativa
      let activeSections: WebsiteSection[] = [];
      if (active) {
        const { data: secRows } = await supabase
          .from("page_sections")
          .select("id, type, content, sort_order")
          .eq("page_id", active.id)
          .order("sort_order", { ascending: true });

        activeSections = (secRows ?? []).map((r) => ({
          id: r.id,
          type: r.type as WebsiteSection["type"],
          content: r.content as WebsiteSection["content"],
        }));
      }

      if (cancelled) return;
      setBranding(composedBranding);
      setPages(pageList);
      setCurrentPage(active);
      setSections(activeSections);
      setLoading(false);
    }

    void fetchAll();
    return () => {
      cancelled = true;
    };
  }, [effectiveUserId, targetSlug]);

  const seoTitle = useMemo(() => {
    if (currentPage?.seo_title) return currentPage.seo_title;
    if (branding) return `${currentPage?.title ?? "Início"} | ${branding.site_title}`;
    return "Carregando…";
  }, [currentPage, branding]);

  const seoDescription = currentPage?.seo_description ?? "";

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8 space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[60vh] w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!branding || !currentPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Site não configurado</h2>
            <p className="text-muted-foreground text-sm">
              Ainda não existem páginas publicadas para este utilizador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const visiblePages = pages.filter((p) => p.is_published || p.id === currentPage.id);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* SEO — preenchido por auto-generate-meta-tags */}
      <Helmet>
        <title>{seoTitle}</title>
        {seoDescription && <meta name="description" content={seoDescription} />}
        <meta property="og:title" content={seoTitle} />
        {seoDescription && <meta property="og:description" content={seoDescription} />}
        <meta property="og:type" content="website" />
        {branding.logo_url && <meta property="og:image" content={branding.logo_url} />}
      </Helmet>

      {/* NAVBAR dinâmica */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <nav className="container mx-auto flex items-center justify-between py-4 px-4">
          <Link to={`/site/home`} className="flex items-center gap-2">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.site_title} className="h-8 w-auto" />
            ) : (
              <span className="text-lg font-bold text-primary">{branding.site_title}</span>
            )}
          </Link>

          <ul className="hidden md:flex items-center gap-6">
            {visiblePages.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/site/${p.slug}`}
                  className={`text-sm transition-colors hover:text-primary ${
                    p.id === currentPage.id ? "text-primary font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>

          {branding.phone && (
            <Button asChild size="sm" variant="default">
              <a href={`tel:${branding.phone}`}>Contactar</a>
            </Button>
          )}
        </nav>
      </header>

      {/* SECÇÕES dinâmicas */}
      <main className="flex-1">
        {currentPage.legal_markdown ? (
          <section className="container mx-auto max-w-4xl px-4 py-16">
            <article className="prose prose-sm dark:prose-invert max-w-none">
              {renderLegalMarkdown(currentPage.legal_markdown)}
            </article>
          </section>
        ) : sections.length === 0 ? (
          <section className="container mx-auto py-24 text-center">
            <h1 className="text-4xl font-bold mb-4">{branding.site_title}</h1>
            <p className="text-muted-foreground">Esta página ainda não tem secções configuradas.</p>
          </section>
        ) : (
          sections.map((section) => <SectionRenderer key={section.id} section={section} branding={branding} />)
        )}
      </main>

      {/* RODAPÉ */}
      <footer className="border-t border-border bg-muted/30 mt-12">
        <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="font-semibold text-foreground mb-2">{branding.site_title}</h3>
            {branding.legal_name && (
              <p className="text-xs text-muted-foreground">{branding.legal_name}</p>
            )}
          </div>
          <div>
            <h4 className="font-medium text-sm mb-2">Páginas</h4>
            <ul className="space-y-1">
              {visiblePages.map((p) => (
                <li key={p.id}>
                  <Link to={`/site/${p.slug}`} className="text-xs text-muted-foreground hover:text-primary">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-2">Contacto</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {branding.email && <li>{branding.email}</li>}
              {branding.phone && <li>{branding.phone}</li>}
            </ul>
            <div className="flex gap-3 mt-3">
              {branding.facebook_url && (
                <a href={branding.facebook_url} className="text-xs text-muted-foreground hover:text-primary">
                  Facebook
                </a>
              )}
              {branding.instagram_url && (
                <a href={branding.instagram_url} className="text-xs text-muted-foreground hover:text-primary">
                  Instagram
                </a>
              )}
              {branding.linkedin_url && (
                <a href={branding.linkedin_url} className="text-xs text-muted-foreground hover:text-primary">
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {branding.legal_name || branding.site_title}. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------- Section Renderer ----------------------------- */

function SectionRenderer({ section, branding }: { section: WebsiteSection; branding: BrandingData }) {
  switch (section.type) {
    case "hero":
      return (
        <section
          className="relative py-24 px-4 text-center bg-cover bg-center"
          style={
            section.content.backgroundImage
              ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${section.content.backgroundImage})` }
              : undefined
          }
        >
          <div className="container mx-auto max-w-3xl text-white">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              {section.content.title || branding.site_title}
            </h1>
            {section.content.subtitle && (
              <p className="text-lg md:text-xl mb-6 opacity-90">{section.content.subtitle}</p>
            )}
            {section.content.buttonText && (
              <Button size="lg" variant="default">
                {section.content.buttonText}
              </Button>
            )}
          </div>
        </section>
      );

    case "features":
      return (
        <section className="py-20 px-4 bg-background">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">{section.content.title}</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {(section.content.items ?? []).map((item, i) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg mb-2 text-primary">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      );

    case "testimonials":
      return (
        <section className="py-20 px-4 bg-muted/30">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">{section.content.title}</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {(section.content.items ?? []).map((item, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <p className="italic text-muted-foreground mb-3">"{item.desc}"</p>
                    <p className="font-semibold text-sm">— {item.title}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      );

    case "cta":
      return (
        <section className="py-20 px-4 bg-primary text-primary-foreground text-center">
          <div className="container mx-auto max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{section.content.title}</h2>
            {section.content.subtitle && <p className="mb-6 opacity-90">{section.content.subtitle}</p>}
            {section.content.buttonText && (
              <Button size="lg" variant="secondary">
                {section.content.buttonText}
              </Button>
            )}
          </div>
        </section>
      );

    case "contact":
      return (
        <section className="py-20 px-4 bg-background">
          <div className="container mx-auto max-w-xl text-center">
            <h2 className="text-3xl font-bold mb-4">{section.content.title}</h2>
            {section.content.subtitle && (
              <p className="text-muted-foreground mb-6">{section.content.subtitle}</p>
            )}
            {branding.email && (
              <Button asChild size="lg">
                <a href={`mailto:${branding.email}`}>{branding.email}</a>
              </Button>
            )}
          </div>
        </section>
      );

    case "custom_html":
      return (
        <section
          className="py-12 px-4"
          // Conteúdo controlado pelo próprio dono do projeto (RLS) — sem injeção externa
          dangerouslySetInnerHTML={{ __html: section.content.html ?? "" }}
        />
      );

    default:
      return null;
  }
}

export default DynamicPageRenderer;
