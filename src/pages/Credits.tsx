import { CreditWallet } from "@/components/subscription/CreditWallet";
import { Wallet } from "lucide-react";

export default function Credits() {
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
