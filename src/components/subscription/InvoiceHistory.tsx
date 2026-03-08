import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, ExternalLink, Receipt } from "lucide-react";
import { useInvoices } from "@/hooks/useInvoices";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Pago", variant: "default" },
  open: { label: "Em aberto", variant: "secondary" },
  void: { label: "Anulado", variant: "outline" },
  uncollectible: { label: "Incobr.", variant: "destructive" },
  draft: { label: "Rascunho", variant: "outline" },
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function InvoiceHistory() {
  const { invoices, loading, error } = useInvoices();

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Histórico de Faturas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Ainda não existem faturas.
          </p>
        ) : (
          <div className="divide-y divide-border/50">
            {invoices.map((inv) => {
              const status = STATUS_MAP[inv.status ?? ""] ?? STATUS_MAP.draft;
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between py-3 gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {inv.number ?? inv.id.slice(0, 16)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(inv.created)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold">
                      {formatCurrency(inv.amount_paid || inv.amount_due, inv.currency)}
                    </span>
                    <Badge variant={status.variant} className="text-xs">
                      {status.label}
                    </Badge>
                    <div className="flex gap-1">
                      {inv.hosted_invoice_url && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {inv.invoice_pdf && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
