import { useState, useEffect, useRef } from "react";
import { TemplateGallery } from "@/components/builder/TemplateGallery";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Plus,
  Eye,
  Code,
  Layout,
  Star,
  MessageSquare,
  Phone,
  Trash2,
  GripVertical,
  Sparkles,
  Loader2,
  Check,
  FileText,
  Rocket,
  LayoutTemplate,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseCustom";
import { useSiteBuilder } from "@/hooks/useSiteBuilder";
import type { WebsiteSection } from "@/types/nexus";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AIImageField } from "@/components/builder/AIImageField";
import { type BrandColors } from "@/components/builder/BrandColorPicker";
import { loadGoogleFont, type BrandFonts } from "@/components/builder/BrandFontPicker";
import { PublishFlow } from "@/components/builder/PublishFlow";
import { ConciergeWizard } from "@/components/builder/ConciergeWizard";
import { AIWriteSectionButton } from "@/components/builder/AIWriteSectionButton";
import { useAutoSeedLegalPages } from "@/hooks/useAutoSeedLegalPages";
import {
  buildBusinessFallbackSection,
  getSectorBrandDefaults,
  normalizeBusinessSector,
  sectionNeedsBusinessRewrite,
  type BuilderBusinessData,
} from "@/lib/builderDefaults";

const sectionTypes = [
  { type: 'hero', label: 'Hero', icon: Layout },
  { type: 'features', label: 'Funcionalidades', icon: Star },
  { type: 'testimonials', label: 'Testemunhos', icon: MessageSquare },
  { type: 'cta', label: 'Call to Action', icon: Sparkles },
  { type: 'contact', label: 'Contacto', icon: Phone },
  { type: 'custom_html', label: 'HTML Personalizado', icon: Code },
] as const;

export default function SiteBuilder() {
  const {
    pages,
    currentPageId,
    sections,
    updateSections,
    loading,
    saving,
    loadPageSections,
    addPage,
    deletePage,
    projectId,
  } = useSiteBuilder();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const defaultBrand = getSectorBrandDefaults(null);
  const [brandColors, setBrandColors] = useState<BrandColors>(defaultBrand.colors);
  const [brandFonts, setBrandFonts] = useState<BrandFonts>(defaultBrand.fonts);
  const [brandInherited, setBrandInherited] = useState(false);
  const [brandReady, setBrandReady] = useState(false);
  const [businessData, setBusinessData] = useState<BuilderBusinessData | null>(null);
  const [autoRewriting, setAutoRewriting] = useState(false);
  const autoRewriteRef = useRef<string | null>(null);

  // Auto-criar páginas legais (Privacidade, Termos, Cookies) com os dados do Perfil da Empresa
  useAutoSeedLegalPages(projectId);

  // Herança obrigatória e silenciosa: o Builder lê o Perfil/Empresa e aplica marca,
  // logótipo, setor e dados reais sem pedir cores ou fontes ao utilizador.
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: proj }, { data: bp }, { data: prof }] = await Promise.all([
        supabase.from("projects").select("name, brand_colors, brand_fonts, logo_url, business_name, trade_name, legal_name, business_sector, description, city, email, phone, website").eq("id", projectId).maybeSingle(),
        supabase.from("business_profiles").select("trade_name, legal_name, logo_url, city, email, phone, website").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("company_name, business_sector, ai_custom_instructions, contact_email").eq("user_id", user.id).maybeSingle(),
      ]);

      const business: BuilderBusinessData = {
        name: (bp as any)?.trade_name || (proj as any)?.trade_name || (proj as any)?.business_name || (prof as any)?.company_name || (proj as any)?.name || "Cascais Property",
        legalName: (bp as any)?.legal_name || (proj as any)?.legal_name || undefined,
        sector: (proj as any)?.business_sector || (prof as any)?.business_sector || undefined,
        description: (proj as any)?.description || (prof as any)?.ai_custom_instructions || undefined,
        city: (bp as any)?.city || (proj as any)?.city || undefined,
        logoUrl: (bp as any)?.logo_url || (proj as any)?.logo_url || undefined,
        email: (bp as any)?.email || (proj as any)?.email || (prof as any)?.contact_email || user.email || undefined,
        phone: (bp as any)?.phone || (proj as any)?.phone || undefined,
        website: (bp as any)?.website || (proj as any)?.website || undefined,
      };
      business.normalizedSector = normalizeBusinessSector(business.sector) || undefined;
      setBusinessData(business);

      const defaults = getSectorBrandDefaults(business.normalizedSector || business.sector);
      const bc = (proj as any)?.brand_colors as BrandColors | null;
      const bf = (proj as any)?.brand_fonts as BrandFonts | null;
      const finalColors: BrandColors = bc?.primary ? bc : defaults.colors;
      const finalFonts: BrandFonts = bf?.heading ? bf : defaults.fonts;

      const patch: Record<string, unknown> = {};
      if (!bc?.primary) patch.brand_colors = finalColors;
      if (!bf?.heading) patch.brand_fonts = finalFonts;
      if (business.logoUrl && !(proj as any)?.logo_url) patch.logo_url = business.logoUrl;
      if (business.name && !(proj as any)?.business_name) patch.business_name = business.name;
      if (business.sector && !(proj as any)?.business_sector) patch.business_sector = business.sector;
      if (Object.keys(patch).length > 0) {
        await supabase.from("projects").update(patch as any).eq("id", projectId);
      }

      setBrandColors(finalColors);
      setBrandFonts(finalFonts);
      loadGoogleFont(finalFonts.heading);
      loadGoogleFont(finalFonts.body);
      setBrandInherited(true);
      setBrandReady(true);
    })();
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !businessData || sections.length === 0) return;
    const signature = `${projectId}:${sections.map((s) => `${s.id}:${s.content.title}`).join("|")}`;
    if (autoRewriteRef.current === signature) return;
    const targets = sections.filter((s) => sectionNeedsBusinessRewrite(s, businessData.normalizedSector || businessData.sector));
    if (targets.length === 0) return;
    autoRewriteRef.current = signature;

    (async () => {
      setAutoRewriting(true);
      const rewritten = await Promise.all(sections.map(async (section) => {
        if (!targets.some((target) => target.id === section.id)) return section;
        try {
          const { data, error } = await supabase.functions.invoke("generate-section-content", {
            body: { section: { type: section.type, content: section.content }, business: businessData },
          });
          if (error || data?.error || !data?.content) throw error || new Error(data?.error || "AI fallback");
          return { ...section, content: { ...section.content, ...data.content } };
        } catch {
          return { ...section, content: buildBusinessFallbackSection(section, businessData) };
        }
      }));
      updateSections(rewritten);
      setAutoRewriting(false);
    })();
  }, [projectId, businessData, sections, updateSections]);


  const currentPage = pages.find((p) => p.id === currentPageId);

  const addSection = (type: WebsiteSection['type']) => {
    const newSection: WebsiteSection = {
      id: crypto.randomUUID(),
      type,
      content: {
        title: `Nova Secção ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        subtitle: '',
        buttonText: type === 'cta' ? 'Saiba Mais' : undefined,
        items: type === 'features' || type === 'testimonials' ? [] : undefined,
        html: type === 'custom_html' ? '<div class="p-8 text-center">HTML Personalizado</div>' : undefined,
      }
    };
    updateSections([...sections, newSection]);
    setSelectedSection(newSection.id);
  };

  const updateSection = (id: string, updates: Partial<WebsiteSection['content']>) => {
    updateSections(sections.map(s => 
      s.id === id ? { ...s, content: { ...s.content, ...updates } } : s
    ));
  };

  const deleteSection = (id: string) => {
    updateSections(sections.filter(s => s.id !== id));
    if (selectedSection === id) setSelectedSection(null);
  };

  const moveSection = (id: string, direction: -1 | 1) => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const next = [...sections];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    updateSections(next);
  };

  const handleAddPage = async () => {
    if (!newPageTitle.trim()) return;
    const slug = newPageSlug.trim() || newPageTitle.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    await addPage(newPageTitle.trim(), slug);
    setNewPageTitle("");
    setNewPageSlug("");
    setAddPageOpen(false);
  };

  const handlePageChange = (pageId: string) => {
    setSelectedSection(null);
    loadPageSections(pageId);
  };


  const handlePublish = async () => {
    if (!currentPage) return;
    setPublishing(true);
    try {
      const { error: updErr } = await supabase
        .from("pages")
        .update({ is_published: true })
        .eq("id", currentPage.id);
      if (updErr) throw updErr;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sem sessão");
      const { data: proj } = await supabase
        .from("projects")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!proj) throw new Error("Projeto não encontrado");

      const { error: fnErr } = await supabase.functions.invoke("auto-generate-meta-tags", {
        body: { pageId: currentPage.id, projectId: proj.id },
      });
      if (fnErr) {
        console.warn("[publish] meta-tags falhou:", fnErr);
        toast.success("Página publicada (meta tags falharam — tenta novamente)");
      } else {
        toast.success("Página publicada e meta tags geradas ✓");
      }
    } catch (e) {
      console.error("[publish] erro:", e);
      toast.error("Erro ao publicar página");
    } finally {
      setPublishing(false);
    }
  };

  const selectedSectionData = sections.find(s => s.id === selectedSection);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderPreview = () => {
    const headingFont = `'${brandFonts.heading}', sans-serif`;
    const bodyFont = `'${brandFonts.body}', sans-serif`;
    return (
      <div
        className="bg-white text-gray-900 min-h-[600px] rounded-lg overflow-hidden"
        style={{ fontFamily: bodyFont }}
      >
        {sections.map((section) => (
          <div key={section.id} className="border-b border-gray-200 last:border-b-0">
            {section.type === 'hero' && (
              <div 
                className="relative h-96 flex items-center justify-center text-center p-8"
                style={{ 
                  backgroundImage: section.content.backgroundImage 
                    ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${section.content.backgroundImage})` 
                    : `linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.secondary} 100%)`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="text-white">
                  <h1 className="text-4xl font-bold mb-4" style={{ fontFamily: headingFont }}>{section.content.title}</h1>
                  {section.content.subtitle && (
                    <p className="text-xl mb-6 opacity-90">{section.content.subtitle}</p>
                  )}
                  {section.content.buttonText && (
                    <button
                      className="px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                      style={{ background: brandColors.accent, color: '#fff' }}
                    >
                      {section.content.buttonText}
                    </button>
                  )}
                </div>
              </div>
            )}

            {section.type === 'features' && (
              <div className="p-12 bg-gray-50">
                <h2 className="text-3xl font-bold text-center mb-8" style={{ color: brandColors.primary, fontFamily: headingFont }}>
                  {section.content.title}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {section.content.items?.map((item, i) => (
                    <div key={i} className="bg-white p-6 rounded-lg shadow-sm text-center border-t-4" style={{ borderTopColor: brandColors.accent }}>
                      <h3 className="font-semibold text-lg mb-2" style={{ color: brandColors.secondary }}>{item.title}</h3>
                      <p className="text-gray-600">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {section.type === 'testimonials' && (
              <div className="p-12 bg-white">
                <h2 className="text-3xl font-bold text-center mb-8" style={{ color: brandColors.primary, fontFamily: headingFont }}>
                  {section.content.title}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {section.content.items?.map((item, i) => (
                    <div key={i} className="bg-gray-50 p-6 rounded-lg border-l-4" style={{ borderLeftColor: brandColors.accent }}>
                      <p className="text-gray-600 italic mb-4">"{item.desc}"</p>
                      <p className="font-semibold" style={{ color: brandColors.secondary }}>{item.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {section.type === 'cta' && (
              <div
                className="p-12 text-white text-center"
                style={{ background: `linear-gradient(90deg, ${brandColors.primary}, ${brandColors.secondary})` }}
              >
                <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: headingFont }}>{section.content.title}</h2>
                {section.content.subtitle && (
                  <p className="text-xl mb-6 opacity-90">{section.content.subtitle}</p>
                )}
                {section.content.buttonText && (
                  <button
                    className="px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                    style={{ background: brandColors.accent, color: '#fff' }}
                  >
                    {section.content.buttonText}
                  </button>
                )}
              </div>
            )}

            {section.type === 'contact' && (
              <div className="p-12 bg-gray-50">
                <h2 className="text-3xl font-bold text-center mb-8" style={{ color: brandColors.primary, fontFamily: headingFont }}>
                  {section.content.title}
                </h2>
                <div className="max-w-md mx-auto space-y-4">
                  <input type="text" placeholder="Nome" className="w-full p-3 border rounded-lg" />
                  <input type="email" placeholder="Email" className="w-full p-3 border rounded-lg" />
                  <textarea placeholder="Mensagem" rows={4} className="w-full p-3 border rounded-lg" />
                  <button
                    className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                    style={{ background: brandColors.primary }}
                  >
                    {section.content.buttonText || 'Enviar'}
                  </button>
                </div>
              </div>
            )}

            {section.type === 'custom_html' && section.content.html && (
              <div dangerouslySetInnerHTML={{ __html: section.content.html }} />
            )}
          </div>
        ))}
        {sections.length === 0 && (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <p>Esta página ainda não tem secções.</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Globe className="h-8 w-8 text-primary" />
            Site Builder
          </h1>
          <p className="text-muted-foreground mt-1">
            Construa o seu website multi-página
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saving ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> A guardar…
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="h-3 w-3" /> Guardado
            </span>
          )}
          <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
            <LayoutTemplate className="h-4 w-4 mr-2" />
            Modelos
          </Button>
          <Button
            variant={viewMode === 'edit' ? 'default' : 'outline'}
            onClick={() => setViewMode('edit')}
          >
            <Code className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button
            variant={viewMode === 'preview' ? 'default' : 'outline'}
            onClick={() => setViewMode('preview')}
          >
            <Eye className="h-4 w-4 mr-2" />
            Pré-visualizar
          </Button>
        </div>
      </div>

      {/* Concierge Wizard — Guia o utilizador passo-a-passo */}
      <ConciergeWizard
        projectId={projectId}
        hasSections={sections.length > 0}
        hasCustomBrand={
          brandColors.primary !== DEFAULT_BRAND_COLORS.primary ||
          brandFonts.heading !== DEFAULT_BRAND_FONTS.heading
        }
        isPublished={!!currentPage?.is_published}
        onJumpToTemplates={() => setTemplatesOpen(true)}
        onJumpToBrand={() => {
          document.getElementById("brand-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onJumpToPublish={() => {
          document.getElementById("publish-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      {/* Fluxo de Publicação */}
      {currentPage && (
        <div id="publish-section">
          <PublishFlow
            pageSlug={currentPage.slug}
            isPublished={currentPage.is_published}
            publishing={publishing}
            onPublish={handlePublish}
            onPreview={() => setViewMode('preview')}
          />
        </div>
      )}

      {/* Templates Gallery Dialog */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-primary" />
              Galeria de Modelos
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const targetPage = currentPage || pages[0];
            if (!targetPage) {
              return (
                <p className="text-sm text-muted-foreground">
                  Ainda não tens páginas. Cria uma página primeiro com "Nova Página".
                </p>
              );
            }
            return (
              <>
                <p className="text-sm text-muted-foreground -mt-2">
                  Aplicar um modelo substitui as secções da página: <strong>{targetPage.title}</strong>.
                </p>
                <TemplateGallery
                  projectId={(targetPage as any).project_id}
                  pageId={targetPage.id}
                  onApplied={() => {
                    loadPageSections(targetPage.id);
                    setTemplatesOpen(false);
                  }}
                />
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Brand identity (cores + tipografia) — herdadas do Perfil da Empresa */}
      {projectId && (
        <div id="brand-section" className="space-y-6 scroll-mt-4">
          {brandInherited && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-500">
              <Check className="h-3.5 w-3.5" />
              <span>
                Marca <strong>herdada</strong> do{" "}
                <Link to="/settings" className="underline hover:text-emerald-400">
                  Perfil da Empresa
                </Link>
                . Edita abaixo apenas se quiseres ajustar para este site.
              </span>
            </div>
          )}
          <BrandColorPicker
            projectId={projectId}
            value={brandColors}
            onChange={setBrandColors}
          />
          <BrandFontPicker
            projectId={projectId}
            value={brandFonts}
            onChange={setBrandFonts}
          />
        </div>
      )}

      {/* Page Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {pages.map((page) => (
          <div key={page.id} className="flex items-center group">
            <Button
              variant={currentPageId === page.id ? "default" : "outline"}
              size="sm"
              onClick={() => handlePageChange(page.id)}
              className="whitespace-nowrap"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {page.title}
            </Button>
            {pages.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                onClick={() => deletePage(page.id)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
          </div>
        ))}

        <Dialog open={addPageOpen} onOpenChange={setAddPageOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="whitespace-nowrap">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova Página
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Página</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Título da Página</Label>
                <Input
                  value={newPageTitle}
                  onChange={(e) => {
                    setNewPageTitle(e.target.value);
                    setNewPageSlug(
                      e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
                    );
                  }}
                  placeholder="Ex: Galeria, FAQ, Blog..."
                />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL)</Label>
                <Input
                  value={newPageSlug}
                  onChange={(e) => setNewPageSlug(e.target.value)}
                  placeholder="ex: galeria"
                />
              </div>
              <Button onClick={handleAddPage} className="w-full" disabled={!newPageTitle.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Página
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {viewMode === 'preview' ? (
        <Card className="glass overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Pré-visualização: {currentPage?.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {renderPreview()}
          </CardContent>
        </Card>
      ) : sections.length === 0 && currentPage ? (
        <Card className="glass">
          <CardContent className="py-8">
            <TemplateGallery
              projectId={(currentPage as any).project_id}
              pageId={currentPage.id}
              onApplied={() => loadPageSections(currentPage.id)}
            />
            <div className="mt-8 text-center text-sm text-muted-foreground">
              Ou{" "}
              <button
                className="underline text-primary hover:text-primary/80"
                onClick={() => addSection('hero')}
              >
                começa do zero
              </button>{" "}
              adicionando secções manualmente.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section List */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Secções — {currentPage?.title}</CardTitle>
                <CardDescription>Arraste para reordenar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {sections.map((section) => {
                  const typeInfo = sectionTypes.find(t => t.type === section.type);
                  const Icon = typeInfo?.icon || Layout;
                  return (
                    <div
                      key={section.id}
                      onClick={() => setSelectedSection(section.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${
                        selectedSection === section.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{section.content.title}</p>
                          <p className="text-xs text-muted-foreground">{typeInfo?.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Mover para cima"
                          onClick={(e) => { e.stopPropagation(); moveSection(section.id, -1); }}
                          disabled={sections.indexOf(section) === 0}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Mover para baixo"
                          onClick={(e) => { e.stopPropagation(); moveSection(section.id, 1); }}
                          disabled={sections.indexOf(section) === sections.length - 1}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Eliminar"
                          onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {sections.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Esta página ainda não tem secções.
                  </p>
                )}

                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium mb-3">Adicionar Secção</p>
                  <div className="grid grid-cols-2 gap-2">
                    {sectionTypes.map((type) => (
                      <Button
                        key={type.type}
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={() => addSection(type.type)}
                      >
                        <type.icon className="h-4 w-4 mr-2" />
                        {type.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section Editor */}
          <div className="lg:col-span-2">
            {selectedSectionData ? (
              <Card className="glass">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="outline">{selectedSectionData.type}</Badge>
                      Editar Secção
                    </CardTitle>
                    {selectedSectionData.type !== "custom_html" && (
                      <AIWriteSectionButton
                        section={selectedSectionData}
                        onApply={(content) => updateSection(selectedSectionData.id, content)}
                      />
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    Clica em <span className="text-primary font-medium">Escrever com IA</span> para
                    o Concierge preencher esta secção com os dados da tua empresa.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={selectedSectionData.content.title}
                      onChange={(e) => updateSection(selectedSectionData.id, { title: e.target.value })}
                    />
                  </div>

                  {selectedSectionData.type !== 'custom_html' && (
                    <div className="space-y-2">
                      <Label>Subtítulo</Label>
                      <Input
                        value={selectedSectionData.content.subtitle || ''}
                        onChange={(e) => updateSection(selectedSectionData.id, { subtitle: e.target.value })}
                      />
                    </div>
                  )}

                  {['hero', 'cta', 'contact'].includes(selectedSectionData.type) && (
                    <div className="space-y-2">
                      <Label>Texto do Botão</Label>
                      <Input
                        value={selectedSectionData.content.buttonText || ''}
                        onChange={(e) => updateSection(selectedSectionData.id, { buttonText: e.target.value })}
                      />
                    </div>
                  )}

                  {selectedSectionData.type === 'hero' && (
                    <AIImageField
                      value={selectedSectionData.content.backgroundImage || ''}
                      onChange={(url) => updateSection(selectedSectionData.id, { backgroundImage: url })}
                      context="hero"
                      label="Imagem de Fundo"
                    />
                  )}

                  {selectedSectionData.type === 'custom_html' && (
                    <div className="space-y-2">
                      <Label>Código HTML</Label>
                      <Textarea
                        value={selectedSectionData.content.html || ''}
                        onChange={(e) => updateSection(selectedSectionData.id, { html: e.target.value })}
                        rows={10}
                        className="font-mono text-sm"
                        placeholder="<div>O seu HTML aqui...</div>"
                      />
                    </div>
                  )}

                  {['features', 'testimonials'].includes(selectedSectionData.type) && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Itens</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const items = [...(selectedSectionData.content.items || [])];
                            items.push({ title: 'Novo Item', desc: 'Descrição do item' });
                            updateSection(selectedSectionData.id, { items });
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar
                        </Button>
                      </div>
                      {selectedSectionData.content.items?.map((item, index) => (
                        <div key={index} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary">Item {index + 1}</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const items = selectedSectionData.content.items?.filter((_, i) => i !== index);
                                updateSection(selectedSectionData.id, { items });
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <Input
                            value={item.title}
                            onChange={(e) => {
                              const items = [...(selectedSectionData.content.items || [])];
                              items[index] = { ...items[index], title: e.target.value };
                              updateSection(selectedSectionData.id, { items });
                            }}
                            placeholder="Título"
                          />
                          <Textarea
                            value={item.desc}
                            onChange={(e) => {
                              const items = [...(selectedSectionData.content.items || [])];
                              items[index] = { ...items[index], desc: e.target.value };
                              updateSection(selectedSectionData.id, { items });
                            }}
                            placeholder="Descrição"
                            rows={2}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="glass h-96 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Layout className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione uma secção para editar</p>
                  <p className="text-sm mt-2">ou adicione uma nova secção</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
