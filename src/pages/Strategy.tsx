import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Sparkles, 
  Globe, 
  Megaphone, 
  Share2, 
  MessageCircle,
  Loader2,
  Code,
  Copy,
  CheckCircle,
  Server
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { MarketingStrategyInput, MarketingStrategyResult } from "@/types/nexus";

export default function Strategy() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [formData, setFormData] = useState<MarketingStrategyInput>({
    clientName: '',
    productService: '',
    audience: '',
    objective: '',
    plan: 'START',
  });
  const [result, setResult] = useState<MarketingStrategyResult | null>(null);

  const handleGenerate = async () => {
    if (!formData.clientName || !formData.productService || !formData.audience || !formData.objective) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor preencha todos os campos antes de gerar a estratégia.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-strategy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar estratégia');
      }

      const data = await response.json();
      setResult(data);
      toast({
        title: "Estratégia Gerada!",
        description: "A sua estratégia de marketing foi criada com sucesso.",
      });
    } catch (error) {
      console.error('Error generating strategy:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar a estratégia. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const planFeatures = {
    START: ['Site básico', '3 posts/semana', 'SEO básico'],
    PRO: ['Site avançado', '5 posts/semana', 'Google Ads', 'SEO completo'],
    ELITE: ['Site premium', 'Posts diários', 'Google + Meta Ads', 'SEO + WhatsApp AI'],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          Gerador de Estratégia AI
        </h1>
        <p className="text-muted-foreground mt-1">
          Crie uma estratégia de marketing completa em segundos
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Dados do Projeto</CardTitle>
            <CardDescription>
              Preencha as informações para gerar a estratégia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Nome do Cliente/Negócio</Label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="Ex: Clínica Veterinária Patinhas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="productService">Produto/Serviço</Label>
              <Textarea
                id="productService"
                value={formData.productService}
                onChange={(e) => setFormData({ ...formData, productService: e.target.value })}
                placeholder="Ex: Consultas veterinárias, cirurgias, pet shop..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">Público-Alvo</Label>
              <Textarea
                id="audience"
                value={formData.audience}
                onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                placeholder="Ex: Donos de animais de estimação na região de Lisboa, 25-55 anos..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objective">Objetivo Principal</Label>
              <Input
                id="objective"
                value={formData.objective}
                onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                placeholder="Ex: Aumentar agendamentos em 50%"
              />
            </div>

            <div className="space-y-2">
              <Label>Plano</Label>
              <Select
                value={formData.plan}
                onValueChange={(value: 'START' | 'PRO' | 'ELITE') => 
                  setFormData({ ...formData, plan: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="START">START - Essencial</SelectItem>
                  <SelectItem value="PRO">PRO - Avançado</SelectItem>
                  <SelectItem value="ELITE">ELITE - Premium</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2 mt-2">
                {planFeatures[formData.plan].map((feature) => (
                  <Badge key={feature} variant="secondary">{feature}</Badge>
                ))}
              </div>
            </div>

            <Button 
              className="w-full" 
              size="lg"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A gerar estratégia...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Estratégia Completa
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Preview */}
        {result ? (
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Estratégia Gerada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="site" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="site" className="text-xs">
                    <Globe className="h-3 w-3 mr-1" />
                    Site
                  </TabsTrigger>
                  <TabsTrigger value="ads" className="text-xs">
                    <Megaphone className="h-3 w-3 mr-1" />
                    Ads
                  </TabsTrigger>
                  <TabsTrigger value="social" className="text-xs">
                    <Share2 className="h-3 w-3 mr-1" />
                    Social
                  </TabsTrigger>
                  <TabsTrigger value="whatsapp" className="text-xs">
                    <MessageCircle className="h-3 w-3 mr-1" />
                    WhatsApp
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="site" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Título SEO</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(result.site.seo_title, 'seo_title')}
                      >
                        {copied === 'seo_title' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm p-3 bg-muted rounded-lg">{result.site.seo_title}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Meta Descrição</Label>
                    <p className="text-sm p-3 bg-muted rounded-lg">{result.site.meta_description}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        HTML do Site
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(result.site.html, 'html')}
                      >
                        {copied === 'html' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <pre className="text-xs p-3 bg-muted rounded-lg overflow-x-auto max-h-48">
                      {result.site.html.substring(0, 500)}...
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="ads" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-primary font-semibold">Google Ads</Label>
                      <div className="mt-2 space-y-2">
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Headlines</p>
                          {result.ads.google.headlines.map((h, i) => (
                            <Badge key={i} variant="outline" className="mr-1 mb-1">{h}</Badge>
                          ))}
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Descrições</p>
                          {result.ads.google.descriptions.map((d, i) => (
                            <p key={i} className="text-sm">{d}</p>
                          ))}
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Keywords</p>
                          {result.ads.google.keywords.map((k, i) => (
                            <Badge key={i} variant="secondary" className="mr-1 mb-1">{k}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-blue-500 font-semibold">Meta Ads</Label>
                      <div className="mt-2 p-3 bg-muted rounded-lg space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Headline</p>
                          <p className="font-medium">{result.ads.meta.headline}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Primary Text</p>
                          <p className="text-sm">{result.ads.meta.primary_text}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="social" className="space-y-4 mt-4">
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {result.social_media.map((post, i) => (
                      <div key={i} className="p-3 bg-muted rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge>{post.day}</Badge>
                          <Badge variant="outline">{post.theme}</Badge>
                        </div>
                        <p className="text-sm">{post.caption}</p>
                        <p className="text-xs text-muted-foreground italic">
                          🎨 {post.image_prompt}
                        </p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="whatsapp" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    {result.whatsapp_flow.map((flow, i) => (
                      <div key={i} className="p-3 bg-muted rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Trigger</Badge>
                          <span className="text-sm font-medium">{flow.trigger}</span>
                        </div>
                        <div className="pl-4 border-l-2 border-primary">
                          <p className="text-sm">{flow.response}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass h-full min-h-[400px] flex items-center justify-center">
            <div className="text-center text-muted-foreground p-8">
              <Sparkles className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">Preencha o formulário</p>
              <p className="text-sm mt-2">
                e clique em "Gerar Estratégia" para ver os resultados
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Integration Payload Preview */}
      {result && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Payload de Integração
            </CardTitle>
            <CardDescription>
              Configurações prontas para Hostinger e Google Ads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-semibold mb-2 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Hostinger Config
                </p>
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(result.integration_payload.hostinger_config, null, 2)}
                </pre>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-semibold mb-2 flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  Google Ads Config
                </p>
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(result.integration_payload.google_ads_config, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
