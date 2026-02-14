import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Copy, Check, ArrowRight, Facebook, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface SocialSetupFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHasPage: () => void;
}

type Step = "choice" | "create-form" | "create-guide" | "connect";

export function SocialSetupFlow({ open, onOpenChange, onHasPage }: SocialSetupFlowProps) {
  const [step, setStep] = useState<Step>("choice");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [generatedBio, setGeneratedBio] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const generateBio = () => {
    if (!businessName.trim() || !category.trim()) {
      toast.error("Preenche o Nome e a Categoria primeiro.");
      return;
    }
    const bio = `${businessName} — ${category}. ${description || "Soluções profissionais para o teu negócio."}`;
    setGeneratedBio(bio);
    setStep("create-guide");
  };

  const handleClose = () => {
    setStep("choice");
    setBusinessName("");
    setCategory("");
    setDescription("");
    setGeneratedBio("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        {step === "choice" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Facebook className="h-6 w-6 text-neon-blue" />
                Ligar Redes Sociais
              </DialogTitle>
              <DialogDescription>
                Precisamos da tua Página do Facebook para publicar conteúdo e anúncios.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 mt-4">
              <Button
                variant="outline"
                className="h-auto p-5 flex flex-col items-start gap-2 border-neon-blue/30 hover:border-neon-blue/60 hover:bg-neon-blue/5"
                onClick={() => {
                  handleClose();
                  onHasPage();
                }}
              >
                <span className="text-base font-semibold text-foreground">✅ Já tenho uma Página</span>
                <span className="text-sm text-muted-foreground text-left">Vou ligar a minha página do Facebook/Instagram existente.</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto p-5 flex flex-col items-start gap-2 border-neon-purple/30 hover:border-neon-purple/60 hover:bg-neon-purple/5"
                onClick={() => setStep("create-form")}
              >
                <span className="text-base font-semibold text-foreground">🆕 Não tenho — Quero criar</span>
                <span className="text-sm text-muted-foreground text-left">O Nexus ajuda-te a criar uma em minutos.</span>
              </Button>
            </div>
          </>
        )}

        {step === "create-form" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-neon-purple" />
                Dados do teu Negócio
              </DialogTitle>
              <DialogDescription>
                Preenche estes 3 campos e o Nexus gera uma Bio criativa para ti.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nome do Negócio</Label>
                <Input placeholder="Ex: Padaria do João" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input placeholder="Ex: Restaurante, Imobiliária, Fitness..." value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Breve Descrição <span className="text-muted-foreground">(opcional)</span></Label>
                <Textarea placeholder="O que torna o teu negócio especial?" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <Button onClick={generateBio} className="w-full gap-2 bg-neon-purple hover:bg-neon-purple/90 text-white" size="lg">
                <Sparkles className="h-4 w-4" />
                Gerar Bio & Avançar
              </Button>
            </div>
          </>
        )}

        {step === "create-guide" && (
          <>
            <DialogHeader>
              <DialogTitle>📋 3 Passos para Criar a tua Página</DialogTitle>
              <DialogDescription>Segue estes passos simples e volta aqui quando terminares.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 mt-4">
              {/* Generated Bio */}
              {generatedBio && (
                <div className="p-3 rounded-lg border border-neon-purple/30 bg-neon-purple/5">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium text-neon-purple">Bio Gerada pelo Nexus</span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyText(generatedBio, "bio")}>
                      {copiedField === "bio" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <p className="text-sm text-foreground">{generatedBio}</p>
                </div>
              )}

              {/* Steps */}
              {[
                { num: 1, text: "Abre a página de criação do Facebook", copyVal: businessName, copyLabel: "nome" },
                { num: 2, text: "Preenche o Nome e a Categoria (cola os dados abaixo)", copyVal: category, copyLabel: "categoria" },
                { num: 3, text: "Cola a Bio gerada e publica a página" },
              ].map((s) => (
                <div key={s.num} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-neon-blue/20 flex items-center justify-center shrink-0">
                    <span className="font-bold text-sm text-neon-blue">{s.num}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{s.text}</p>
                    {s.copyVal && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs mt-1 gap-1" onClick={() => copyText(s.copyVal!, s.copyLabel!)}>
                        {copiedField === s.copyLabel ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        Copiar {s.copyLabel}
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Open Facebook Button */}
              <Button
                variant="outline"
                className="w-full gap-2 border-neon-blue/40 text-neon-blue hover:bg-neon-blue/10"
                onClick={() => window.open("https://www.facebook.com/pages/create", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Abrir Facebook — Criar Página
              </Button>

              {/* Confirmation Button */}
              <Button
                className="w-full gap-2 bg-neon-green hover:bg-neon-green/90 text-background font-bold"
                size="lg"
                onClick={() => {
                  handleClose();
                  onHasPage();
                }}
              >
                <Check className="h-5 w-5" />
                Já criei! Vamos ligar agora.
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
