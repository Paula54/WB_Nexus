import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Users, Plus, Upload, Send, TestTube, Sparkles, Trash2, BarChart3,
} from "lucide-react";

// --- Types ---
interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  status: string;
  source: string;
  created_at: string;
}

interface Campaign {
  id: string;
  subject: string;
  content: string;
  status: string;
  sent_count: number;
  sent_at: string | null;
  created_at: string;
}

// ==================== CONTACTS TAB ====================
function ContactsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchSubscribers = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("subscribers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setSubscribers((data as Subscriber[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSubscribers(); }, [fetchSubscribers]);

  const addSubscriber = async () => {
    if (!user || !newEmail.trim()) return;
    const { error } = await supabase.from("subscribers").insert({
      user_id: user.id, email: newEmail.trim(), name: newName.trim() || null,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contacto adicionado" });
      setNewEmail(""); setNewName("");
      fetchSubscribers();
    }
  };

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    const rows = lines.slice(1).map((l) => {
      const [email, name] = l.split(",").map((s) => s.trim().replace(/"/g, ""));
      return { user_id: user.id, email, name: name || null };
    }).filter((r) => r.email.includes("@"));

    if (!rows.length) { toast({ title: "Nenhum contacto válido no CSV", variant: "destructive" }); return; }

    const { error } = await supabase.from("subscribers").upsert(rows, { onConflict: "user_id,email" });
    if (error) toast({ title: "Erro na importação", description: error.message, variant: "destructive" });
    else toast({ title: `${rows.length} contactos importados` });
    fetchSubscribers();
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeSubscriber = async (id: string) => {
    await supabase.from("subscribers").delete().eq("id", id);
    fetchSubscribers();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Adicionar Contacto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <Input placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="max-w-xs" />
            <Input placeholder="Nome (opcional)" value={newName} onChange={(e) => setNewName(e.target.value)} className="max-w-xs" />
            <Button onClick={addSubscriber}><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
            <div className="relative">
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Importar CSV
              </Button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">CSV: email,nome (uma linha por contacto)</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Lista de Contactos ({subscribers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : subscribers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Ainda não tens contactos. Adiciona ou importa acima.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {subscribers.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div>
                    <span className="font-medium">{s.email}</span>
                    {s.name && <span className="text-muted-foreground ml-2">({s.name})</span>}
                    <Badge variant="outline" className="ml-2 text-xs">{s.source}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeSubscriber(s.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== NEWSLETTER EDITOR TAB ====================
function NewsletterTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const fetchCampaigns = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setCampaigns((data as Campaign[]) || []);
  }, [user]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const saveDraft = async () => {
    if (!user || !subject.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("email_campaigns").insert({
      user_id: user.id, subject: subject.trim(), content, status: "draft",
    });
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Rascunho guardado" }); fetchCampaigns(); }
  };

  const sendTest = async (campaignId: string) => {
    if (!testEmail.trim()) { toast({ title: "Insere um email de teste", variant: "destructive" }); return; }
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("send-newsletter", {
      body: { campaign_id: campaignId, test_email: testEmail.trim() },
    });
    setTesting(false);
    if (error) toast({ title: "Erro no teste", description: error.message, variant: "destructive" });
    else toast({ title: "Email de teste enviado!" });
  };

  const sendCampaign = async (campaignId: string) => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-newsletter", {
      body: { campaign_id: campaignId },
    });
    setSending(false);
    if (error) toast({ title: "Erro no envio", description: error.message, variant: "destructive" });
    else {
      toast({ title: `Newsletter enviada para ${(data as any)?.sent_count || 0} contactos!` });
      fetchCampaigns();
    }
  };

  const generateWithAI = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("nexus-concierge", {
        body: {
          messages: [
            { role: "user", content: `Escreve uma newsletter profissional em HTML sobre: ${subject || "novidades do negócio"}. Inclui um título, 2-3 parágrafos e um call-to-action. Responde APENAS com o HTML.` },
          ],
        },
      });
      if (data && typeof data === "object" && "reply" in data) {
        setContent((data as any).reply);
        toast({ title: "Conteúdo gerado com IA!" });
      }
    } catch (e) {
      toast({ title: "Erro na geração IA", variant: "destructive" });
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Nova Newsletter</CardTitle>
          <CardDescription>Cria e envia newsletters para a tua lista de contactos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Assunto da newsletter" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={generateWithAI} disabled={generating}>
              <Sparkles className="w-4 h-4 mr-1" /> {generating ? "A gerar..." : "Gerar com IA"}
            </Button>
          </div>
          <Textarea
            placeholder="Conteúdo HTML da newsletter..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
          <div className="flex gap-3 flex-wrap">
            <Button onClick={saveDraft} disabled={saving || !subject.trim()}>
              {saving ? "A guardar..." : "Guardar Rascunho"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input placeholder="Email para teste" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="max-w-xs" />
          </div>
          {campaigns.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma campanha criada.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div>
                    <p className="font-medium">{c.subject}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={c.status === "sent" ? "default" : "secondary"}>
                        {c.status === "sent" ? "Enviado" : "Rascunho"}
                      </Badge>
                      {c.sent_count > 0 && (
                        <span className="text-xs text-muted-foreground">{c.sent_count} enviados</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {c.status === "draft" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => sendTest(c.id)} disabled={testing}>
                          <TestTube className="w-4 h-4 mr-1" /> Teste
                        </Button>
                        <Button size="sm" onClick={() => sendCampaign(c.id)} disabled={sending}>
                          <Send className="w-4 h-4 mr-1" /> Enviar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== MAIN PAGE ====================
export default function Marketing() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Mail className="w-8 h-8 text-primary" /> Marketing por Email
        </h1>
        <p className="text-muted-foreground mt-1">
          Gere a tua lista de contactos e envia newsletters profissionais.
        </p>
      </div>

      <Tabs defaultValue="newsletter" className="w-full">
        <TabsList>
          <TabsTrigger value="newsletter"><Mail className="w-4 h-4 mr-1" /> Newsletter</TabsTrigger>
          <TabsTrigger value="contacts"><Users className="w-4 h-4 mr-1" /> Contactos</TabsTrigger>
        </TabsList>
        <TabsContent value="newsletter"><NewsletterTab /></TabsContent>
        <TabsContent value="contacts"><ContactsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
