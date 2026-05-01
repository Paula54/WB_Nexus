import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, Flame, Phone, Mail, Calendar, StickyNote, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { LeadImportDialog } from "@/components/crm/LeadImportDialog";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  priority: string | null;
  ai_classification: string | null;
  notes: string | null;
  reminder_date: string | null;
  tags: string[] | null;
  value: number | null;
  source: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;
const STATUSES = ["novo", "contactado", "qualificado", "perdido"];
const PRIORITIES = ["low", "medium", "high"];

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

  useEffect(() => {
    if (user) fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function fetchLeads() {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("[CRM] Error fetching leads:", error);
    } else {
      const list = (data || []) as Lead[];
      setLeads(list);
      const tags = new Set<string>();
      list.forEach((l) => l.tags?.forEach((t) => tags.add(t)));
      setAllTags(Array.from(tags).sort());
    }
    setLoading(false);
  }

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("leads").insert({
      name: newLead.name,
      email: newLead.email || null,
      phone: newLead.phone || null,
      user_id: user.id,
    });
    if (error) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível adicionar o contacto." });
    } else {
      toast({ title: "Potencial cliente adicionado" });
      setNewLead({ name: "", email: "", phone: "" });
      setShowAddForm(false);
      fetchLeads();
    }
  }

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (priorityFilter !== "all" && l.priority !== priorityFilter) return false;
      if (tagFilter !== "all" && !l.tags?.includes(tagFilter)) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          l.name.toLowerCase().includes(s) ||
          l.email?.toLowerCase().includes(s) ||
          l.phone?.includes(searchTerm) ||
          l.company?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [leads, searchTerm, statusFilter, priorityFilter, tagFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [searchTerm, statusFilter, priorityFilter, tagFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "novo": return "bg-blue-500/20 text-blue-400";
      case "contactado": return "bg-yellow-500/20 text-yellow-400";
      case "qualificado": return "bg-green-500/20 text-green-400";
      case "perdido": return "bg-red-500/20 text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Gestão de Vendas</h1>
          <p className="text-muted-foreground mt-1">Os teus potenciais clientes e oportunidades de negócio</p>
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

      {/* Filtros */}
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

      {/* Resultados */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              {leads.length === 0 ? "Ainda não tens potenciais clientes. Adiciona ou importa o primeiro!" : "Nenhum resultado para os filtros aplicados."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageItems.map((lead) => (
              <Card key={lead.id} className="glass hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{lead.name}</h3>
                      {lead.ai_classification === "hot" && <Flame className="h-4 w-4 text-orange-500" />}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(lead.status)}`}>{lead.status}</span>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {lead.company && <div className="text-foreground/80 text-xs">{lead.company}</div>}
                    {lead.email && (
                      <div className="flex items-center gap-2"><Mail className="h-3 w-3" /><span className="truncate">{lead.email}</span></div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-2"><Phone className="h-3 w-3" /><span>{lead.phone}</span></div>
                    )}
                    {lead.reminder_date && (
                      <div className="flex items-center gap-2 text-primary">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(lead.reminder_date), "d MMM, HH:mm", { locale: pt })}</span>
                      </div>
                    )}
                    {lead.notes && (
                      <div className="flex items-start gap-2 mt-2"><StickyNote className="h-3 w-3 mt-0.5" /><span className="line-clamp-2">{lead.notes}</span></div>
                    )}
                    {lead.tags && lead.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        {lead.tags.slice(0, 4).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
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
    </div>
  );
}
