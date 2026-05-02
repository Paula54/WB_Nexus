import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Wand2, Eye, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";

interface TemplatePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: {
    id: string;
    title: string;
    template_name: string | null;
    template_description: string | null;
    template_sector: string | null;
    content: any;
  } | null;
  onApply: () => void;
  applying: boolean;
}

function PreviewSection({ section }: { section: any }) {
  const c = section.content || {};
  switch (section.type) {
    case "hero":
      return (
        <section
          className="relative py-20 px-6 text-center bg-cover bg-center"
          style={
            c.backgroundImage
              ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${c.backgroundImage})` }
              : { background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" }
          }
        >
          <div className="max-w-3xl mx-auto text-white">
            <h1 className="text-3xl md:text-5xl font-bold mb-3 drop-shadow">{c.title || "Título"}</h1>
            {c.subtitle && <p className="text-base md:text-lg mb-5 opacity-90">{c.subtitle}</p>}
            {c.buttonText && (
              <span className="inline-block px-5 py-2 rounded-md bg-white text-black font-semibold text-sm">
                {c.buttonText}
              </span>
            )}
          </div>
        </section>
      );
    case "features":
      return (
        <section className="py-14 px-6 bg-background">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">{c.title}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {(c.items ?? []).map((it: any, i: number) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-primary mb-1">{it.title}</h3>
                    <p className="text-sm text-muted-foreground">{it.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      );
    case "testimonials":
      return (
        <section className="py-14 px-6 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">{c.title}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {(c.items ?? []).map((it: any, i: number) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <p className="italic text-muted-foreground mb-2 text-sm">"{it.desc}"</p>
                    <p className="font-semibold text-sm">— {it.title}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      );
    case "cta":
      return (
        <section className="py-14 px-6 bg-primary text-primary-foreground text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">{c.title}</h2>
            {c.subtitle && <p className="mb-5 opacity-90">{c.subtitle}</p>}
            {c.buttonText && (
              <span className="inline-block px-5 py-2 rounded-md bg-background text-foreground font-semibold text-sm">
                {c.buttonText}
              </span>
            )}
          </div>
        </section>
      );
    case "contact":
      return (
        <section className="py-14 px-6 bg-background text-center">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">{c.title}</h2>
            {c.subtitle && <p className="text-muted-foreground mb-5">{c.subtitle}</p>}
          </div>
        </section>
      );
    default:
      return (
        <section className="py-8 px-6 bg-muted/20 text-center text-xs text-muted-foreground">
          [Secção: {section.type}]
        </section>
      );
  }
}

export function TemplatePreviewModal({ open, onOpenChange, template, onApply, applying }: TemplatePreviewModalProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  if (!template) return null;
  const sections = Array.isArray(template.content?.sections) ? template.content.sections : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                {template.template_name || template.title}
              </DialogTitle>
              <DialogDescription className="line-clamp-1">
                {template.template_description || "Pré-visualização completa antes de aplicar."}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {template.template_sector && (
                <Badge variant="secondary" className="capitalize">{template.template_sector}</Badge>
              )}
              <div className="flex border rounded-md overflow-hidden">
                <Button
                  type="button"
                  size="sm"
                  variant={device === "desktop" ? "default" : "ghost"}
                  className="rounded-none h-8"
                  onClick={() => setDevice("desktop")}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={device === "mobile" ? "default" : "ghost"}
                  className="rounded-none h-8"
                  onClick={() => setDevice("mobile")}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/30 p-4">
          <div
            className={`mx-auto bg-background border rounded-lg overflow-hidden shadow-lg transition-all ${
              device === "mobile" ? "max-w-[390px]" : "max-w-full"
            }`}
          >
            {/* Mock browser bar */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/60 border-b">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="ml-3 text-[10px] text-muted-foreground">nexus.web-business.pt</span>
            </div>
            {/* Mock navbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b bg-background">
              <span className="text-sm font-bold text-primary">{template.template_name || "O Meu Negócio"}</span>
              <div className="hidden md:flex gap-4 text-xs text-muted-foreground">
                <span>Início</span><span>Serviços</span><span>Sobre</span><span>Contacto</span>
              </div>
            </div>

            {sections.length === 0 ? (
              <div className="py-20 text-center text-sm text-muted-foreground">
                Modelo sem secções definidas.
              </div>
            ) : (
              sections.map((s: any, i: number) => <PreviewSection key={s.id || i} section={s} />)
            )}

            {/* Mock footer */}
            <div className="px-5 py-6 border-t bg-muted/30 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} {template.template_name || "O Meu Negócio"}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground hidden sm:block">
              A IA personalizará textos e imagens com os dados da tua empresa após aplicar.
            </p>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
                Cancelar
              </Button>
              <Button onClick={onApply} disabled={applying}>
                {applying ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A aplicar…</>
                ) : (
                  <><Wand2 className="h-4 w-4 mr-2" /> Aplicar este modelo</>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
