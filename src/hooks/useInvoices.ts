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

      setLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke("list-invoices");

        if (fnError) throw new Error(fnError.message);

        const rows = (data?.invoices as StripeInvoice[] | undefined) ?? [];
        setInvoices(rows);
      } catch (err) {
        console.error("[useInvoices] Failed to load invoices:", err);
        setError(err instanceof Error ? err.message : "Não foi possível carregar as faturas.");
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, [user]);

  return { invoices, loading, error };
}
