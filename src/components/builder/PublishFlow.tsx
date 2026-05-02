import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Globe,
  Eye,
  Rocket,
  Copy,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const FINAL_DOMAIN = "nexus.web-business.pt";

interface Props {
  pageSlug?: string;
  isPublished?: boolean;
  publishing: boolean;
  onPublish: () => void | Promise<void>;
  onPreview: () => void;
}

export function PublishFlow({ pageSlug = "home", isPublished, publishing, onPublish, onPreview }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  const generatePreviewLink = () => {
    // Token temporário client-side (hash + slug). Não persiste — apenas para partilha rápida.
    const token = crypto.randomUUID().slice(0, 8);
    setPreviewToken(token);
    const link = `${window.location.origin}/preview/${pageSlug}?t=${token}`;
    navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Link de pré-visualização copiado ✓", {
      description: "Válido nesta sessão. Partilha para receber feedback antes de publicar.",
    });
  };

  const finalUrl = `https://${FINAL_DOMAIN}/${pageSlug === "home" ? "" : pageSlug}`;

  return (
    <Card className="glass border-primary/30 bg-gradient-to-br from-primary/5 via-background to-purple-500/5">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm flex items-center gap-2">
                Fluxo de Publicação
                {isPublished && (
                  <Badge variant="outline" className="border-emerald-500/50 text-emerald-500 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Publicada
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                O teu site será publicado em:{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono">
                  {FINAL_DOMAIN}
                </code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPreview}>
              <Eye className="h-4 w-4 mr-1.5" /> Pré-visualizar
            </Button>
            <Button variant="outline" size="sm" onClick={generatePreviewLink}>
              <LinkIcon className="h-4 w-4 mr-1.5" /> Link Temporário
            </Button>
            <Button
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={publishing}
              className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4 mr-1.5" />
              )}
              {isPublished ? "Republicar" : "Publicar agora"}
            </Button>
          </div>
        </div>

        {previewToken && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">Link de pré-visualização (já copiado)</p>
              <p className="text-xs text-muted-foreground truncate font-mono">
                {window.location.origin}/preview/{pageSlug}?t={previewToken}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/preview/${pageSlug}?t=${previewToken}`
                );
                toast.success("Copiado");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Confirmação de publicação */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                Publicar página
              </DialogTitle>
              <DialogDescription>
                Confirma os detalhes antes de tornar a página visível ao público.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">URL final:</span>
                <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs">{finalUrl}</code>
                <a
                  href={finalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline ml-1"
                  title="Abrir em nova aba"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Conformidade legal automática</p>
                    <p className="text-muted-foreground">
                      As páginas de Privacidade, Cookies e Termos serão geradas com os dados da tua{" "}
                      <Link to="/settings" className="text-primary underline">
                        Configuração da Empresa
                      </Link>
                      . Não tens de repetir nada.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  await onPublish();
                  setConfirmOpen(false);
                }}
                disabled={publishing}
                className="bg-gradient-to-r from-primary to-purple-600"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4 mr-2" />
                )}
                Confirmar publicação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
