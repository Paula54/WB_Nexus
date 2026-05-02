import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseCustom";
import { toast } from "sonner";
import type { WebsiteSection } from "@/types/nexus";

interface Props {
  section: WebsiteSection;
  onApply: (newContent: WebsiteSection["content"]) => void;
}

/**
 * Pede ao Concierge para reescrever a secção atual usando os dados da empresa
 * (nome, setor, cidade, descrição). Substitui placeholders genéricos.
 */
export function AIWriteSectionButton({ section, onApply }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-section-content", {
        body: { section: { type: section.type, content: section.content } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.content) throw new Error("Sem resposta da IA");

      // Preserva campos não tocados pela IA (ex: backgroundImage, html)
      onApply({ ...section.content, ...data.content });
      toast.success("Secção reescrita com os dados da tua empresa ✨");
    } catch (e: any) {
      console.error("[AIWriteSectionButton]", e);
      toast.error(e?.message || "Não consegui gerar conteúdo agora");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="border-primary/40 text-primary hover:bg-primary/10"
    >
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
          A escrever…
        </>
      ) : (
        <>
          <Sparkles className="h-3.5 w-3.5 mr-2" />
          Escrever com IA
        </>
      )}
    </Button>
  );
}
