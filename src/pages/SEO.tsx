import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, TrendingUp, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { SeoAnalysis } from "@/types/nexus";

export default function SEO() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<SeoAnalysis | null>({
    score: 72,
    suggestions: [
      'Adicionar meta description mais detalhada',
      'Melhorar velocidade de carregamento',
      'Adicionar alt text em todas as imagens',
      'Criar sitemap.xml',
      'Implementar schema markup'
    ],
    keywords: ['marketing digital', 'agência', 'SEO', 'Lisboa', 'Portugal']
  });

  const handleAnalyze = async () => {
    if (!url) return;
    setLoading(true);
    // Simulated analysis - in production this would call an edge function
    setTimeout(() => {
      setAnalysis({
        score: Math.floor(Math.random() * 30) + 60,
        suggestions: [
          'Adicionar meta description mais detalhada',
          'Melhorar velocidade de carregamento',
          'Adicionar alt text em todas as imagens',
          'Criar sitemap.xml',
          'Implementar schema markup'
        ],
        keywords: ['marketing digital', 'agência', 'SEO', 'Lisboa', 'Portugal']
      });
      setLoading(false);
    }, 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Search className="h-8 w-8 text-primary" />
          Visibilidade no Google
        </h1>
        <p className="text-muted-foreground mt-1">
          Descobre como o teu negócio aparece nas pesquisas e melhora a tua presença
        </p>
      </div>

      {/* URL Input */}
      <Card className="glass">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Input
              placeholder="https://exemplo.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? (
                <span className="animate-pulse">Analisando...</span>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Analisar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Score */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Score de Visibilidade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className={`text-6xl font-bold ${getScoreColor(analysis.score)}`}>
                  {analysis.score}
                </div>
                <p className="text-muted-foreground mt-2">de 100 pontos</p>
                <div className="mt-4 h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      analysis.score >= 80 ? 'bg-green-500' :
                      analysis.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${analysis.score}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Suggestions */}
          <Card className="glass lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Sugestões de Melhoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis.suggestions.map((suggestion, i) => (
                  <div 
                    key={i}
                    className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                    <span className="text-sm">{suggestion}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Keywords */}
          <Card className="glass lg:col-span-3">
            <CardHeader>
              <CardTitle>Keywords Detetadas</CardTitle>
              <CardDescription>
                Palavras-chave identificadas no seu conteúdo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {analysis.keywords.map((keyword, i) => (
                  <Badge key={i} variant="secondary" className="text-sm py-1 px-3">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
