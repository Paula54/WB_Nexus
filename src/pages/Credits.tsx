import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditWallet } from "@/components/subscription/CreditWallet";
import { Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Credits() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const topup = searchParams.get("topup");
    if (topup === "success") {
      toast({ title: "Créditos adquiridos! 🎉", description: "Os teus créditos foram adicionados à carteira." });
      setSearchParams({}, { replace: true });
    } else if (topup === "cancel") {
      toast({ title: "Compra cancelada", description: "Podes tentar novamente.", variant: "destructive" });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Wallet className="h-8 w-8 text-primary" />
          Carteira AI Fuel
        </h1>
        <p className="text-muted-foreground mt-1">
          Gere os teus créditos de inteligência artificial
        </p>
      </div>
      <CreditWallet />
    </div>
  );
}
