import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Globe, Search, Wallet, Plus, ArrowUpRight, ArrowDownLeft,
  CheckCircle2, XCircle, Loader2, ShoppingCart, CreditCard, Sparkles
} from "lucide-react";

interface DomainResult {
  domain: string;
  available: boolean;
  costPrice: number;
  finalPrice: number;
  tld: string;
  suggestions: Array<{ domain: string; tld: string; costPrice: number; finalPrice: number }>;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

interface DomainRegistration {
  id: string;
  domain_name: string;
  status: string;
  purchase_price: number;
  created_at: string;
}

export default function Domains() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<DomainResult | null>(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [domains, setDomains] = useState<DomainRegistration[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");

  useEffect(() => {
    if (user) fetchWalletData();
  }, [user]);

  async function fetchWalletData() {
    if (!user) return;
    setLoadingWallet(true);
    const [txRes, domRes] = await Promise.all([
      supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("domain_registrations").select("*").order("created_at", { ascending: false }),
    ]);
    const txs = (txRes.data || []) as Transaction[];
    setTransactions(txs);
    setBalance(txs.reduce((sum, t) => sum + t.amount, 0));
    setDomains((domRes.data || []) as DomainRegistration[]);
    setLoadingWallet(false);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("domain-search", {
        body: { domain: searchQuery.includes(".") ? searchQuery : `${searchQuery}.com` },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error("Erro na pesquisa: " + (e.message || "Tenta novamente"));
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase(domain: string, finalPrice: number, costPrice: number) {
    if (balance < finalPrice) {
      toast.error("Saldo insuficiente. Carrega a tua Wallet primeiro.");
      return;
    }
    setPurchasing(domain);
    try {
      const { data, error } = await supabase.functions.invoke("domain-register", {
        body: { domain, finalPrice, costPrice },
      });
      if (error) throw error;
      if (data.error) {
        toast.error(data.error);
        return;
      }
      toast.success(`🎉 ${domain} registado com sucesso!`);
      setResult(null);
      setSearchQuery("");
      fetchWalletData();
    } catch (e: any) {
      toast.error("Erro ao registar: " + (e.message || "Tenta novamente"));
    } finally {
      setPurchasing(null);
    }
  }

  async function handleDeposit() {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      toast.error("Insere um valor válido");
      return;
    }
    // Simulated deposit — in production this would go through Stripe
    if (!user) return;
    const { error } = await supabase.from("wallet_transactions").insert({
      user_id: user.id,
      amount,
      type: "deposit",
      description: `Carregamento de saldo`,
    });
    if (error) {
      toast.error("Erro ao processar depósito");
      return;
    }
    toast.success(`+${amount.toFixed(2)} € adicionados à Wallet`);
    setDepositAmount("");
    fetchWalletData();
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case "deposit": return <ArrowDownLeft className="h-4 w-4 text-neon-green" />;
      case "domain_purchase": return <Globe className="h-4 w-4 text-primary" />;
      case "ad_credit": return <Sparkles className="h-4 w-4 text-neon-purple" />;
      default: return <CreditCard className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "deposit": return "Depósito";
      case "domain_purchase": return "Compra de Domínio";
      case "ad_credit": return "Crédito de Anúncios";
      default: return type;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Globe className="h-8 w-8 text-primary" />
          O Teu Lugar na Internet
        </h1>
        <p className="text-muted-foreground mt-1">Pesquisa, compra e configura o teu domínio em segundos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Domain Search */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search Bar */}
          <Card className="glass">
            <CardContent className="p-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="cascais-property.com"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pesquisar"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Search Results */}
          {result && (
            <div className="space-y-4 animate-fade-in">
              {/* Main result */}
              <Card className={`glass border ${result.available ? "border-neon-green/30" : "border-destructive/30"}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {result.available ? (
                        <CheckCircle2 className="h-6 w-6 text-neon-green" />
                      ) : (
                        <XCircle className="h-6 w-6 text-destructive" />
                      )}
                      <div>
                        <p className="font-semibold text-lg text-foreground">{result.domain}</p>
                        <p className="text-sm text-muted-foreground">
                          {result.available ? "Disponível para registo" : "Indisponível"}
                        </p>
                      </div>
                    </div>
                    {result.available && (
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-foreground">{result.finalPrice.toFixed(2)} €</p>
                          <p className="text-xs text-muted-foreground">/ano</p>
                        </div>
                        <Button
                          onClick={() => handlePurchase(result.domain, result.finalPrice, result.costPrice)}
                          disabled={purchasing === result.domain || balance < result.finalPrice}
                          className="gap-2"
                        >
                          {purchasing === result.domain ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShoppingCart className="h-4 w-4" />
                          )}
                          Comprar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Suggestions */}
              {result.suggestions.length > 0 && (
                <Card className="glass">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Alternativas disponíveis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {result.suggestions.map((s) => (
                      <div key={s.domain} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">.{s.tld}</Badge>
                          <span className="text-sm font-medium text-foreground">{s.domain}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">{s.finalPrice.toFixed(2)} €</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSearchQuery(s.domain);
                              setResult(null);
                              setTimeout(handleSearch, 100);
                            }}
                          >
                            Verificar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* My Domains */}
          {domains.length > 0 && (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Os Meus Domínios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {domains.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30 text-xs">Ativo</Badge>
                      <span className="font-medium text-foreground">{d.domain_name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString("pt-PT")}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Wallet */}
        <div className="space-y-6">
          {/* Balance */}
          <Card className="glass border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5 text-primary" />
                Nexus Wallet
              </CardTitle>
              <CardDescription>Saldo disponível</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-foreground mb-4">
                {loadingWallet ? "—" : `${balance.toFixed(2)} €`}
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="50.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="flex-1"
                  min="1"
                  step="0.01"
                />
                <Button onClick={handleDeposit} className="gap-1.5 shrink-0">
                  <Plus className="h-4 w-4" />
                  Carregar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Simulação — integração Stripe em breve</p>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5 text-primary" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem transações</p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                      {typeIcon(tx.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{typeLabel(tx.type)} · {new Date(tx.created_at).toLocaleDateString("pt-PT")}</p>
                      </div>
                      <span className={`text-sm font-semibold ${tx.amount > 0 ? "text-neon-green" : "text-destructive"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)} €
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
