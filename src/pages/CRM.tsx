import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, Flame, Phone, Mail, Calendar, StickyNote } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  ai_classification: string | null;
  notes: string | null;
  reminder_date: string | null;
  created_at: string;
}

export default function CRM() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    fetchLeads();
  }, [user]);

  async function fetchLeads() {
    if (!user) return;

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching leads:", error);
    } else {
      setLeads(data || []);
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
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível adicionar o lead.",
      });
    } else {
      toast({
        title: "Lead adicionado",
        description: `${newLead.name} foi adicionado com sucesso.`,
      });
      setNewLead({ name: "", email: "", phone: "" });
      setShowAddForm(false);
      fetchLeads();
    }
  }

  const filteredLeads = leads.filter(
    (lead) =>
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone?.includes(searchTerm)
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "novo":
        return "bg-blue-500/20 text-blue-400";
      case "contactado":
        return "bg-yellow-500/20 text-yellow-400";
      case "qualificado":
        return "bg-green-500/20 text-green-400";
      case "perdido":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground mt-1">
            Gestão de leads e contactos
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lead
        </Button>
      </div>

      {/* Add Lead Form */}
      {showAddForm && (
        <Card className="glass">
          <CardHeader>
            <CardTitle>Adicionar Lead</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addLead} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={newLead.name}
                    onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Adicionar</Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar leads..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Leads Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="glass animate-pulse">
              <CardContent className="p-4 h-32" />
            </Card>
          ))}
        </div>
      ) : filteredLeads.length === 0 ? (
        <Card className="glass">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              {searchTerm ? "Nenhum lead encontrado." : "Ainda não tem leads. Adicione o primeiro!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((lead) => (
            <Card key={lead.id} className="glass hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{lead.name}</h3>
                    {lead.ai_classification === "hot" && (
                      <Flame className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {lead.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                  {lead.reminder_date && (
                    <div className="flex items-center gap-2 text-primary">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {format(new Date(lead.reminder_date), "d MMM, HH:mm", { locale: pt })}
                      </span>
                    </div>
                  )}
                  {lead.notes && (
                    <div className="flex items-start gap-2 mt-2">
                      <StickyNote className="h-3 w-3 mt-0.5" />
                      <span className="line-clamp-2">{lead.notes}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
