import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Mail, Users, Plus, Upload, Send, TestTube, Sparkles, Trash2, BarChart3, Eye, Tag, Image as ImageIcon, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// --- Types ---
interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  status: string;
  source: string;
  tags: string[] | null;
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

interface Asset {
  id: string;
  file_name: string;
  public_url: string | null;
  mime_type: string | null;
}

// ==================== CONTACTS TAB ====================
function ContactsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState("");
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
    const tagsArr = newTags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from("subscribers").insert({
      user_id: user.id,
      email: newEmail.trim(),
      name: newName.trim() || null,
      tags: tagsArr,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contacto adicionado" });
      setNewEmail(""); setNewName(""); setNewTags("");
      fetchSubscribers();
    }
  };

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    const rows = lines.slice(1).map((l) => {
      const [email, name, tagsRaw] = l.split(",").map((s) => s.trim().replace(/"/g, ""));
      const tags = tagsRaw ? tagsRaw.split(";").map((t) => t.trim()).filter(Boolean) : [];
      return { user_id: user.id, email, name: name || null, tags };
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
            <Input placeholder="Tags (ex: T2, Lisboa)" value={newTags} onChange={(e) => setNewTags(e.target.value)} className="max-w-xs" />
            <Button onClick={addSubscriber}><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
            <div className="relative">
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Importar CSV
              </Button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">CSV: email,nome,tags (tags separadas por ; — ex: T2;Lisboa)</p>
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
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{s.email}</span>
                    {s.name && <span className="text-muted-foreground ml-2">({s.name})</span>}
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{s.source}</Badge>
                      {s.status === "unsubscribed" && <Badge variant="destructive" className="text-xs">Cancelou</Badge>}
                      {(s.tags || []).map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs"><Tag className="w-3 h-3 mr-0.5" />{t}</Badge>
                      ))}
                    </div>
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

// ==================== ASSET PICKER ====================
function AssetPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (urls: string[]) => void }) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !user) return;
    supabase.from("assets")
      .select("id,file_name,public_url,mime_type")
      .eq("user_id", user.id)
      .like("mime_type", "image/%")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setAssets((data as Asset[]) || []));
  }, [open, user]);

  const toggle = (url: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(url)) n.delete(url); else if (n.size < 5) n.add(url);
      return n;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Escolhe imagens da Biblioteca (até 5)</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
          {assets.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">Sem imagens na biblioteca.</p>}
          {assets.map((a) => (
            <button
              key={a.id}
              onClick={() => a.public_url && toggle(a.public_url)}
              className={`relative rounded-lg overflow-hidden border-2 transition ${a.public_url && selected.has(a.public_url) ? "border-primary" : "border-transparent"}`}
            >
              <img src={a.public_url || ""} alt={a.file_name} className="w-full h-24 object-cover" />
              {a.public_url && selected.has(a.public_url) && (
                <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</div>
              )}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { onPick(Array.from(selected)); setSelected(new Set()); onClose(); }}>
            Usar {selected.size} imagem(ns)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== NEWSLETTER EDITOR TAB ====================
function NewsletterTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [briefing, setBriefing] = useState("");
  const [pickedAssets, setPickedAssets] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

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

  const fetchTags = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("subscribers")
      .select("tags")
      .eq("user_id", user.id)
      .eq("status", "active");
    const tagSet = new Set<string>();
    ((data as { tags: string[] | null }[]) || []).forEach((s) => (s.tags || []).forEach((t) => tagSet.add(t)));
    setAllTags(Array.from(tagSet).sort());
  }, [user]);

  useEffect(() => { fetchCampaigns(); fetchTags(); }, [fetchCampaigns, fetchTags]);

  const toggleTag = (t: string) => setSelectedTags((s) => {
    const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n;
  });

  const saveDraft = async () => {
    if (!user || !subject.trim()) {
      toast({ title: "Define um assunto", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("email_campaigns").insert({
      user_id: user.id, subject: subject.trim(), content, status: "draft",
    });
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Rascunho guardado" }); fetchCampaigns(); setSubject(""); setContent(""); setBriefing(""); setPickedAssets([]); }
  };

  const segmentTags = useMemo(() => Array.from(selectedTags), [selectedTags]);

  const sendTest = async (campaignId: string) => {
    if (!testEmail.trim()) { toast({ title: "Insere um email de teste", variant: "destructive" }); return; }
    setTesting(campaignId);
    const { error } = await supabase.functions.invoke("send-newsletter", {
      body: { campaign_id: campaignId, test_email: testEmail.trim() },
    });
    setTesting(null);
    if (error) toast({ title: "Erro no teste", description: error.message, variant: "destructive" });
    else toast({ title: `Email de teste enviado para ${testEmail}` });
  };

  const sendCampaign = async (campaignId: string) => {
    setSending(campaignId);
    const { data, error } = await supabase.functions.invoke("send-newsletter", {
      body: { campaign_id: campaignId, segment_tags: segmentTags },
    });
    setSending(null);
    if (error) toast({ title: "Erro no envio", description: error.message, variant: "destructive" });
    else {
      toast({ title: `Newsletter enviada para ${(data as { sent_count?: number })?.sent_count || 0} contactos!` });
      fetchCampaigns();
    }
  };

  const generateWithAI = async () => {
    if (!briefing.trim()) {
      toast({ title: "Escreve um briefing", description: "Diz à IA sobre o que queres falar.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-newsletter-content", {
        body: { briefing, asset_urls: pickedAssets },
      });
      if (error) throw error;
      const d = data as { html?: string; subject?: string };
      if (d?.html) {
        setContent(d.html);
        if (d.subject && !subject) setSubject(d.subject);
        toast({ title: "Conteúdo gerado!", description: "Custou 10 AI Fuel." });
      }
    } catch (e: unknown) {
      toast({ title: "Erro na geração IA", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Gerador IA</CardTitle>
          <CardDescription>Descreve o tema e a IA escreve a newsletter adaptada ao teu sector. Custo: 10 AI Fuel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Ex: Promoção de Páscoa com 20% nos serviços; ou: Lançamento do novo T2 em Cascais com piscina..."
            value={briefing}
            onChange={(e) => setBriefing(e.target.value)}
            className="min-h-[80px]"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <ImageIcon className="w-4 h-4 mr-1" /> Anexar imagens ({pickedAssets.length})
            </Button>
            {pickedAssets.map((url) => (
              <div key={url} className="relative">
                <img src={url} alt="" className="w-12 h-12 rounded object-cover border" />
                <button
                  onClick={() => setPickedAssets((p) => p.filter((u) => u !== url))}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <Button onClick={generateWithAI} disabled={generating}>
              <Sparkles className="w-4 h-4 mr-1" /> {generating ? "A gerar..." : "Gerar com IA"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Newsletter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Assunto da newsletter" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea
            placeholder="Conteúdo HTML (gerado pela IA ou manual)..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[200px] font-mono text-xs"
          />
          <div className="flex gap-3 flex-wrap">
            <Button onClick={saveDraft} disabled={saving || !subject.trim()}>
              {saving ? "A guardar..." : "Guardar Rascunho"}
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!content}>
              <Eye className="w-4 h-4 mr-1" /> Pré-visualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Campanhas e Envio</CardTitle>
          <CardDescription>Define o segmento e envia teste antes do disparo real.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email para teste</Label>
            <Input placeholder="teste@exemplo.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="max-w-xs" />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Tag className="w-4 h-4" /> Segmentação por Tags</Label>
            <div className="flex gap-2 flex-wrap">
              <Badge
                variant={selectedTags.size === 0 ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedTags(new Set())}
              >
                Todos
              </Badge>
              {allTags.length === 0 && <span className="text-xs text-muted-foreground">Sem tags ainda. Adiciona tags aos contactos.</span>}
              {allTags.map((t) => (
                <Badge
                  key={t}
                  variant={selectedTags.has(t) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTag(t)}
                >
                  {t}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedTags.size === 0 ? "Vai enviar para TODOS os contactos ativos." : `Vai enviar a contactos com qualquer destas tags: ${segmentTags.join(", ")}`}
            </p>
          </div>

          {campaigns.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma campanha criada.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4 rounded-lg border bg-card flex-wrap gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{c.subject}</p>
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
                        <Button variant="outline" size="sm" onClick={() => sendTest(c.id)} disabled={testing === c.id}>
                          <TestTube className="w-4 h-4 mr-1" /> {testing === c.id ? "A enviar..." : "Enviar Teste"}
                        </Button>
                        <Button size="sm" onClick={() => sendCampaign(c.id)} disabled={sending === c.id}>
                          <Send className="w-4 h-4 mr-1" /> {sending === c.id ? "A disparar..." : "Disparar Campanha"}
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

      <AssetPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={setPickedAssets} />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Pré-visualização (apenas conteúdo)</DialogTitle></DialogHeader>
          <div className="bg-white rounded-lg p-6 max-h-[60vh] overflow-y-auto text-black">
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </div>
          <p className="text-xs text-muted-foreground">O envio real inclui automaticamente header com logo, footer com unsubscribe e botões de redes sociais.</p>
        </DialogContent>
      </Dialog>
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
          Lista de contactos, segmentação por tags, IA criativa e envios profissionais com a tua marca.
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
