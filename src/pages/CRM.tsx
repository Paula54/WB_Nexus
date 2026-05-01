import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Search, Flame, Phone, Mail, Calendar, StickyNote, Upload,
  ChevronLeft, ChevronRight, MessageCircle, Pencil, Mailbox,
  Users, TrendingUp, Target, CheckCircle2, ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { LeadImportDialog } from "@/components/crm/LeadImportDialog";
import { LeadEditSheet, type Lead, STATUSES, PRIORITIES } from "@/components/crm/LeadEditSheet";

const PAGE_SIZE = 20;

export default function CRM() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", email: "", phone: "" });
  const [editing, setEditing] = useState<Lead | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addingNewsletter, setAddingNewsletter] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLeads = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Server-side filtering — RLS ensures only this user's rows
    let query = supabase
      .from("leads")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (priorityFilter !== "all") query = query.eq("priority", priorityFilter);
    if (tagFilter !== "all") query = query.contains("tags", [tagFilter]);
    if (searchTerm.trim()) {
      const s = `%${searchTerm.trim()}%`;
      query = query.or(`name.ilike.${s},email.ilike.${s},phone.ilike.${s},company.ilike.${s}`);
    }

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("[CRM] fetch error:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar contactos." });
    } else {
      setLeads((data || []) as Lead[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [user, statusFilter, priorityFilter, tagFilter, searchTerm, page]);

  // Fetch all tags once for the filter dropdown (separate light query)
  const fetchTags = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("leads")
      .select("tags")
      .eq("user_id", user.id)
      .not("tags", "is", null)
      .limit(500);
    const set = new Set<string>();
    (data || []).forEach((r: any) => (r.tags || []).forEach((t: string) => set.add(t)));
    setAllTags(Array.from(set).sort());
  }, [user]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { fetchTags(); }, [fetchTags]);
  useEffect(() => { setPage(0); }, [searchTerm, statusFilter, priorityFilter, tagFilter]);

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("leads").insert({
      name: newLead.name.trim(),
      email: newLead.email.trim() || null,
      phone: newLead.phone.trim() || null,
      user_id: user.id,
    });
    if (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível adicionar." });
    } else {
      toast({ title: "Contacto adicionado ✓" });
      setNewLead({ name: "", email: "", phone: "" });
      setShowAddForm(false);
      fetchLeads();
    }
  }

  const updateStatus = async (lead: Lead, newStatus: string) => {
    const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", lead.id);
    if (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar status." });
      return;
    }
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: newStatus } : l));
  };

  const openWhatsApp = (lead: Lead) => {
    if (!lead.phone) {
      toast({ variant: "destructive", title: "Sem número", description: "Este contacto não tem telefone." });
      return;
    }
    const cleaned = lead.phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
    const msg = encodeURIComponent(`Olá ${lead.name.split(" ")[0]}, tudo bem? Estou a contactar do nosso negócio.`);
    window.open(`https://wa.me/${cleaned}?text=${msg}`, "_blank", "noopener,noreferrer");
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id)));
  };

  const addToNewsletter = async () => {
    if (!user || selected.size === 0) return;
    const candidates = leads.filter((l) => selected.has(l.id) && l.email);
    if (candidates.length === 0) {
      toast({ variant: "destructive", title: "Sem emails", description: "Os contactos selecionados não têm email." });
      return;
    }
    setAddingNewsletter(true);

    // Avoid duplicates: fetch existing subscriber emails for this user
    const emails = candidates.map((c) => c.email!.toLowerCase());
    const { data: existing } = await supabase
      .from("subscribers")
      .select("email")
      .eq("user_id", user.id)
      .in("email", emails);
    const existingSet = new Set((existing || []).map((s: any) => s.email.toLowerCase()));

    const rows = candidates
      .filter((c) => !existingSet.has(c.email!.toLowerCase()))
      .map((c) => ({
        user_id: user.id,
        email: c.email!.trim(),
        name: c.name,
        source: "crm",
        status: "active",
        tags: ["crm"],
      }));

    let inserted = 0;
    if (rows.length > 0) {
      const { error, data } = await supabase.from("subscribers").insert(rows).select("id");
      if (error) {
        setAddingNewsletter(false);
        toast({ variant: "destructive", title: "Erro", description: "Falha ao adicionar à newsletter." });
        return;
      }
      inserted = data?.length || 0;
    }
    setAddingNewsletter(false);
    setSelected(new Set());
    toast({
      title: "Newsletter atualizada ✓",
      description: `${inserted} novos · ${existingSet.size} já existiam.`,
    });
  };

  // KPIs derived from current page (could be a separate aggregate query)
  const kpis = useMemo(() => {
    const total = totalCount;
    const novos = leads.filter((l) => l.status === "novo").length;
    const qualificados = leads.filter((l) => l.status === "qualificado").length;
    const hot = leads.filter((l) => (l as any).ai_classification === "hot").length;
    return { total, novos, qualificados, hot };
  }, [leads, totalCount]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const getStatusColor = (status: string) => {
    switch (status) {
      case "novo": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
      case "contactado": return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
      case "qualificado": return "bg-green-500/15 text-green-400 border-green-500/30";
      case "perdido": return "bg-red-500/15 text-red-400 border-red-500/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const getPriorityDot = (p: string | null) => {
    switch (p) {
      case "high": return "bg-red-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-muted";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Gestão de Vendas</h1>
          <p className="text-muted-foreground mt-1">Pipeline operacional · WhatsApp, edição rápida e marketing direto</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-2" /> Importar
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-2" /> Novo
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Total" value={kpis.total} color="text-primary" />
        <KpiCard icon={Target} label="Novos" value={kpis.novos} color="text-blue-400" />
        <KpiCard icon={CheckCircle2} label="Qualificados" value={kpis.qualificados} color="text-green-400" />
        <KpiCard icon={Flame} label="Hot (IA)" value={kpis.hot} color="text-orange-400" />
      </div>

      {showAddForm && (
        <Card className="glass">
          <CardContent className="pt-6">
            <form onSubmit={addLead} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input id="name" value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Adicionar</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filtros (server-side) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tags</SelectItem>
            {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-primary/40 bg-primary/5 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-3 text-sm">
            <Checkbox checked={selected.size === leads.length} onCheckedChange={toggleSelectAll} />
            <span><strong>{selected.size}</strong> selecionado{selected.size !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Limpar</Button>
            <Button size="sm" onClick={addToNewsletter} disabled={addingNewsletter}>
              <Mailbox className="h-4 w-4 mr-2" />
              Adicionar à Newsletter
            </Button>
          </div>
        </div>
      )}

      {/* Resultados */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : leads.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              {totalCount === 0 ? "Ainda não tens contactos. Adiciona ou importa o primeiro!" : "Nenhum resultado para os filtros aplicados."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{totalCount} resultado{totalCount !== 1 ? "s" : ""}</div>
            <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
              {selected.size === leads.length ? "Desmarcar tudo" : "Selecionar página"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leads.map((lead) => {
              const isSelected = selected.has(lead.id);
              return (
                <Card
                  key={lead.id}
                  className={`glass transition-all ${isSelected ? "border-primary ring-1 ring-primary/40" : "hover:border-primary/50"}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(lead.id)} className="mt-1" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${getPriorityDot(lead.priority)}`} title={`Prioridade: ${lead.priority || "n/d"}`} />
                            <h3 className="font-semibold truncate">{lead.name}</h3>
                            {(lead as any).ai_classification === "hot" && <Flame className="h-4 w-4 text-orange-500 shrink-0" />}
                          </div>
                          {lead.company && <div className="text-xs text-foreground/70 mt-0.5 truncate">{lead.company}</div>}
                        </div>
                      </div>

                      {/* Status clicável */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`px-2 py-1 rounded-full text-xs border transition-colors hover:opacity-80 inline-flex items-center gap-1 ${getStatusColor(lead.status)}`}
                          >
                            {lead.status}
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {STATUSES.map((s) => (
                            <DropdownMenuItem key={s} onClick={() => updateStatus(lead, s)}>
                              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getStatusColor(s).split(" ")[0]}`} />
                              {s}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      {lead.email && (
                        <div className="flex items-center gap-2"><Mail className="h-3 w-3" /><span className="truncate">{lead.email}</span></div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-2"><Phone className="h-3 w-3" /><span>{lead.phone}</span></div>
                      )}
                      {(lead as any).reminder_date && (
                        <div className="flex items-center gap-2 text-primary">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date((lead as any).reminder_date), "d MMM, HH:mm", { locale: pt })}</span>
                        </div>
                      )}
                      {lead.notes && (
                        <div className="flex items-start gap-2"><StickyNote className="h-3 w-3 mt-0.5" /><span className="line-clamp-2">{lead.notes}</span></div>
                      )}
                      {lead.tags && lead.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {lead.tags.slice(0, 4).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-border/60">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-green-500/40 text-green-400 hover:bg-green-500/10 hover:text-green-300"
                        onClick={() => openWhatsApp(lead)}
                        disabled={!lead.phone}
                      >
                        <MessageCircle className="h-4 w-4 mr-1.5" />
                        WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => { setEditing(lead); setEditOpen(true); }}
                      >
                        <Pencil className="h-4 w-4 mr-1.5" />
                        Editar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <LeadImportDialog open={showImport} onOpenChange={setShowImport} onImported={fetchLeads} />
      <LeadEditSheet
        lead={editing}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => { fetchLeads(); fetchTags(); }}
      />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card className="glass">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg bg-muted/40 flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
