import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";

export interface StripeInvoice {
  id: string;
  number: string | null;
  status: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: number;
  period_start: number;
  period_end: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

export function useInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<StripeInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoices() {
      if (!user) {
        setInvoices([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error: dbError } = await supabase
          .from("invoices" as any)
          .select("*")
          .eq("user_id", user.id)
          .order("created", { ascending: false })
          .limit(24);

        if (dbError) throw new Error(dbError.message);

        const rows = (data as any[]) ?? [];
        setInvoices(rows.map((row) => ({
          id: row.id,
          number: row.number ?? null,
          status: row.status ?? null,
          amount_due: row.amount_due ?? 0,
          amount_paid: row.amount_paid ?? 0,
          currency: row.currency ?? "eur",
          created: row.created ?? 0,
          period_start: row.period_start ?? 0,
          period_end: row.period_end ?? 0,
          hosted_invoice_url: row.hosted_invoice_url ?? null,
          invoice_pdf: row.invoice_pdf ?? null,
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, [user]);

  return { invoices, loading, error };
}
