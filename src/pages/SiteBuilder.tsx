import { useState } from "react";
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
  LayoutTemplate
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
  } = useSiteBuilder();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

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
    return (
      <div className="bg-white text-gray-900 min-h-[600px] rounded-lg overflow-hidden">
        {sections.map((section) => (
          <div key={section.id} className="border-b border-gray-200 last:border-b-0">
            {section.type === 'hero' && (
              <div 
                className="relative h-96 flex items-center justify-center text-center p-8"
                style={{ 
                  backgroundImage: section.content.backgroundImage 
                    ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${section.content.backgroundImage})` 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="text-white">
                  <h1 className="text-4xl font-bold mb-4">{section.content.title}</h1>
                  {section.content.subtitle && (
                    <p className="text-xl mb-6 opacity-90">{section.content.subtitle}</p>
                  )}
                  {section.content.buttonText && (
                    <button className="bg-white text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100">
                      {section.content.buttonText}
                    </button>
                  )}
                </div>
              </div>
            )}

            {section.type === 'features' && (
              <div className="p-12 bg-gray-50">
                <h2 className="text-3xl font-bold text-center mb-8">{section.content.title}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {section.content.items?.map((item, i) => (
                    <div key={i} className="bg-white p-6 rounded-lg shadow-sm text-center">
                      <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                      <p className="text-gray-600">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {section.type === 'testimonials' && (
              <div className="p-12 bg-white">
                <h2 className="text-3xl font-bold text-center mb-8">{section.content.title}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {section.content.items?.map((item, i) => (
                    <div key={i} className="bg-gray-50 p-6 rounded-lg">
                      <p className="text-gray-600 italic mb-4">"{item.desc}"</p>
                      <p className="font-semibold">{item.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {section.type === 'cta' && (
              <div className="p-12 bg-gradient-to-r from-primary to-blue-600 text-white text-center">
                <h2 className="text-3xl font-bold mb-4">{section.content.title}</h2>
                {section.content.subtitle && (
                  <p className="text-xl mb-6 opacity-90">{section.content.subtitle}</p>
                )}
                {section.content.buttonText && (
                  <button className="bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold">
                    {section.content.buttonText}
                  </button>
                )}
              </div>
            )}

            {section.type === 'contact' && (
              <div className="p-12 bg-gray-50">
                <h2 className="text-3xl font-bold text-center mb-8">{section.content.title}</h2>
                <div className="max-w-md mx-auto space-y-4">
                  <input type="text" placeholder="Nome" className="w-full p-3 border rounded-lg" />
                  <input type="email" placeholder="Email" className="w-full p-3 border rounded-lg" />
                  <textarea placeholder="Mensagem" rows={4} className="w-full p-3 border rounded-lg" />
                  <button className="w-full bg-primary text-white py-3 rounded-lg font-semibold">
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
          <Button onClick={() => setViewMode('edit')}>
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
          <Button
            onClick={handlePublish}
            disabled={publishing || !currentPage}
            className="bg-primary"
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4 mr-2" />
            )}
            {currentPage?.is_published ? "Republicar" : "Publicar"}
          </Button>
        </div>
      </div>

      {/* Templates Gallery Dialog */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-primary" />
              Galeria de Modelos
            </DialogTitle>
          </DialogHeader>
          {currentPage ? (
            <>
              <p className="text-sm text-muted-foreground -mt-2">
                Aplicar a um modelo substitui as secções da página atual: <strong>{currentPage.title}</strong>.
              </p>
              <TemplateGallery
                projectId={(currentPage as any).project_id}
                pageId={currentPage.id}
                onApplied={() => {
                  loadPageSections(currentPage.id);
                  setTemplatesOpen(false);
                }}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Seleciona uma página primeiro.</p>
          )}
        </DialogContent>
      </Dialog>

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
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <Icon className="h-4 w-4 text-primary" />
                        <div>
                          <p className="font-medium text-sm">{section.content.title}</p>
                          <p className="text-xs text-muted-foreground">{typeInfo?.label}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="outline">{selectedSectionData.type}</Badge>
                    Editar Secção
                  </CardTitle>
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
                    <div className="space-y-2">
                      <Label>URL da Imagem de Fundo</Label>
                      <Input
                        value={selectedSectionData.content.backgroundImage || ''}
                        onChange={(e) => updateSection(selectedSectionData.id, { backgroundImage: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
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
