import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabaseCustom";

interface LegalContent {
  title: string;
  content: string;
  updated_at: string;
}

const SLUG_MAP: Record<string, { slug: string; lang: string }> = {
  privacy: { slug: "privacy", lang: "en" },
  privacidade: { slug: "privacy", lang: "pt" },
  terms: { slug: "terms", lang: "en" },
  termos: { slug: "terms", lang: "pt" },
  devolucoes: { slug: "devolucoes", lang: "pt" },
  cookies: { slug: "cookies", lang: "pt" },
};

export default function DynamicLegalPage() {
  const location = useLocation();
  const pathSlug = location.pathname.replace(/^\//, "");
  const mapped = SLUG_MAP[pathSlug];
  const slug = mapped?.slug || pathSlug;
  const lang = mapped?.lang || "pt";
  const [data, setData] = useState<LegalContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(false);

    supabase
      .from("legal_contents")
      .select("title, content, updated_at")
      .eq("slug", slug)
      .eq("language", lang)
      .maybeSingle()
      .then(({ data: row, error: err }) => {
        if (err || !row) {
          console.error("[DynamicLegalPage] Fetch error:", err);
          setError(true);
        } else {
          setData(row as LegalContent);
        }
        setLoading(false);
      });
  }, [slug, lang]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12 px-4">
        <Button asChild variant="ghost" className="mb-8">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Conteúdo não encontrado.</p>
          </div>
        )}

        {data && !loading && (
          <>
            <h1 className="text-3xl font-display font-bold mb-8">{data.title}</h1>
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown>{data.content}</ReactMarkdown>
            </div>
          </>
        )}

        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground space-y-2">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
            <Link to="/privacidade" className="hover:text-primary">Privacidade</Link>
            <Link to="/termos" className="hover:text-primary">Termos</Link>
            <Link to="/cookies" className="hover:text-primary">Cookies</Link>
            <Link to="/data-deletion" className="hover:text-primary">Eliminação de Dados</Link>
            <Link to="/contacto" className="hover:text-primary">Contacto</Link>
          </div>
          <p>
            Nexus © 2026 | Powered by{" "}
            <a href="https://web-business.pt" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Web Business
            </a>{" "}
            – Um produto Astrolábio Mágico Investimentos LDA.
          </p>
          <p>Estrada da Malveira da Serra, 920, Aldeia de Juso, 2750-834 Cascais</p>
        </div>
      </div>
    </div>
  );
}
