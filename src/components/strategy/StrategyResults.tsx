import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Globe,
  Megaphone,
  Share2,
  MessageCircle,
  CheckCircle,
  Copy,
  Code,
  Server,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { MarketingStrategyResult, PlanType } from "@/types/nexus";
import { DecoyComparison } from "./DecoyComparison";

interface StrategyResultsProps {
  result: MarketingStrategyResult;
  plan: PlanType;
}

export function StrategyResults({ result, plan }: StrategyResultsProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const showAds = plan === "GROWTH" || plan === "NEXUS_OS";
  const showSocial = plan === "GROWTH" || plan === "NEXUS_OS";
  const showWhatsApp = plan === "NEXUS_OS";

  const tabCount = 1 + (showAds ? 1 : 0) + (showSocial ? 1 : 0) + (showWhatsApp ? 1 : 0);

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-nexus-gold" />
            Estratégia Gerada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="site" className="w-full">
            <TabsList className={`grid w-full`} style={{ gridTemplateColumns: `repeat(${tabCount}, 1fr)` }}>
              <TabsTrigger value="site" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                Site
              </TabsTrigger>
              {showAds && (
                <TabsTrigger value="ads" className="text-xs">
                  <Megaphone className="h-3 w-3 mr-1" />
                  Ads
                </TabsTrigger>
              )}
              {showSocial && (
                <TabsTrigger value="social" className="text-xs">
                  <Share2 className="h-3 w-3 mr-1" />
                  Social
                </TabsTrigger>
              )}
              {showWhatsApp && (
                <TabsTrigger value="whatsapp" className="text-xs">
                  <MessageCircle className="h-3 w-3 mr-1" />
                  WhatsApp
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="site" className="space-y-4 mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Título SEO</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(result.site.seo_title, "seo_title")}
                  >
                    {copied === "seo_title" ? (
                      <CheckCircle className="h-4 w-4 text-nexus-gold" />
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
                    onClick={() => copyToClipboard(result.site.html, "html")}
                  >
                    {copied === "html" ? (
                      <CheckCircle className="h-4 w-4 text-nexus-gold" />
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

            {showAds && (
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
                        <p className="text-xs text-muted-foreground mb-1">Keywords</p>
                        {result.ads.google.keywords.map((k, i) => (
                          <Badge key={i} variant="secondary" className="mr-1 mb-1">{k}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  {plan === "NEXUS_OS" && (
                    <div>
                      <Label className="font-semibold" style={{ color: "hsl(var(--nexus-gold))" }}>Meta Ads</Label>
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
                  )}
                </div>
              </TabsContent>
            )}

            {showSocial && (
              <TabsContent value="social" className="space-y-4 mt-4">
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {result.social_media.map((post, i) => (
                    <div key={i} className="p-3 bg-muted rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge>{post.day}</Badge>
                        <Badge variant="outline">{post.theme}</Badge>
                      </div>
                      <p className="text-sm">{post.caption}</p>
                      <p className="text-xs text-muted-foreground italic">🎨 {post.image_prompt}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}

            {showWhatsApp && (
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
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* CTA message from AI */}
      {result.cta_message && (
        <div className="rounded-xl border border-nexus-gold/30 bg-nexus-gold/5 p-5 text-center space-y-3">
          <Sparkles className="h-6 w-6 mx-auto text-nexus-gold" />
          <p className="text-sm text-foreground">{result.cta_message}</p>
          <Button className="bg-nexus-gold text-nexus-navy hover:bg-nexus-gold/90 font-bold">
            Ativar 14 Dias Grátis
          </Button>
        </div>
      )}

      {/* Integration Payload */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Payload de Integração
          </CardTitle>
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

      {/* Decoy comparison */}
      <div className="space-y-3">
        <h3 className="text-lg font-display font-bold text-foreground text-center">
          O que estás a poupar com o Nexus OS
        </h3>
        <DecoyComparison />
      </div>
    </div>
  );
}
