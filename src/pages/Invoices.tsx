import { InvoiceHistory } from "@/components/subscription/InvoiceHistory";
import { FileText } from "lucide-react";

export default function Invoices() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          Histórico de Faturas
        </h1>
        <p className="text-muted-foreground mt-1">
          Consulta todas as tuas faturas e recibos
        </p>
      </div>
      <InvoiceHistory />
    </div>
  );
}
