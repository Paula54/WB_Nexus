import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, ListChecks } from "lucide-react";

interface CampaignResult {
  success?: boolean;
  total?: number;
  customer_id?: string;
  campaigns?: Array<{
    id: string;
    name: string;
    status: string;
    channel_type: string;
    impressions: string;
    clicks: string;
    cost_micros: string;
  }>;
  error?: string;
  details?: unknown;
}

interface CampaignTesterProps {
  customerId: string | null;
}

export default function CampaignTester({ customerId }: CampaignTesterProps) {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<CampaignResult | null>(null);

  async function testCampaigns() {
    setTesting(true);
    setResults(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("list-google-campaigns", {
        method: "POST",
      });

      if (fnError) throw fnError;

      const result = data as CampaignResult;
      setResults(result);

      if (result.success) {
        toast({
          title: `${result.total} campanha(s) encontrada(s) ✅`,
          description: `Customer ID: ${result.customer_id}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao listar campanhas",
          description: result.error || "Erro desconhecido",
        });
      }
    } catch (err: unknown) {
      console.error("Test campaigns error:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao contactar a API.",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="border-t border-border/50 pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={testing || !customerId}
          onClick={testCampaigns}
          className="gap-2"
        >
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ListChecks className="h-4 w-4" />
          )}
          {testing ? "A consultar..." : "Sincronizar Dados Reais"}
        </Button>
        {!customerId && (
          <span className="text-xs text-muted-foreground">
            Guarda o Customer ID primeiro
          </span>
        )}
      </div>

      {results && (
        <div className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-2 max-h-64 overflow-y-auto">
          {results.error ? (
            <div className="space-y-1">
              <p className="text-sm text-destructive font-medium">❌ {results.error}</p>
              {results.details && (
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                  {JSON.stringify(results.details, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                ✅ {results.total} campanha(s) encontrada(s)
              </p>
              {results.campaigns && results.campaigns.length > 0 ? (
                <div className="space-y-2">
                  {results.campaigns.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs border-b border-border/30 pb-1.5">
                      <div>
                        <span className="font-medium text-foreground">{c.name}</span>
                        <span className="text-muted-foreground ml-2">({c.channel_type})</span>
                      </div>
                      <Badge variant={c.status === "ENABLED" ? "default" : "secondary"} className="text-[10px]">
                        {c.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma campanha encontrada nesta conta.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
