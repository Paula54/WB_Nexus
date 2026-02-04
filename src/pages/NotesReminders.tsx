import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  StickyNote, 
  Bell, 
  Check, 
  Trash2, 
  Search, 
  Calendar,
  Clock,
  CheckCircle2,
  Circle
} from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { pt } from "date-fns/locale";

interface NoteReminder {
  id: string;
  user_id: string;
  type: "note" | "reminder";
  content: string;
  due_date: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export default function NotesReminders() {
  const { user } = useAuth();
  const [items, setItems] = useState<NoteReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (user) {
      fetchItems();
    }
  }, [user]);

  async function fetchItems() {
    if (!user) return;

    const { data, error } = await supabase
      .from("notes_reminders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notes/reminders:", error);
      toast.error("Erro ao carregar dados");
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }

  async function toggleComplete(item: NoteReminder) {
    const { error } = await supabase
      .from("notes_reminders")
      .update({ is_completed: !item.is_completed })
      .eq("id", item.id);

    if (error) {
      toast.error("Erro ao atualizar");
    } else {
      toast.success(item.is_completed ? "Marcado como pendente" : "Marcado como concluído! ✅");
      fetchItems();
    }
  }

  async function deleteItem(id: string) {
    const { error } = await supabase
      .from("notes_reminders")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao eliminar");
    } else {
      toast.success("Eliminado com sucesso");
      fetchItems();
    }
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "notes") return matchesSearch && item.type === "note";
    if (activeTab === "reminders") return matchesSearch && item.type === "reminder";
    if (activeTab === "pending") return matchesSearch && !item.is_completed;
    if (activeTab === "completed") return matchesSearch && item.is_completed;
    
    return matchesSearch;
  });

  const getDateLabel = (dateStr: string | null) => {
    if (!dateStr) return null;
    
    const date = new Date(dateStr);
    
    if (isToday(date)) {
      return { label: "Hoje", color: "text-yellow-500 bg-yellow-500/10" };
    }
    if (isTomorrow(date)) {
      return { label: "Amanhã", color: "text-blue-400 bg-blue-500/10" };
    }
    if (isPast(date)) {
      return { label: "Atrasado", color: "text-red-500 bg-red-500/10" };
    }
    
    return { 
      label: format(date, "d MMM", { locale: pt }), 
      color: "text-muted-foreground bg-muted" 
    };
  };

  const stats = {
    total: items.length,
    notes: items.filter(i => i.type === "note").length,
    reminders: items.filter(i => i.type === "reminder").length,
    pending: items.filter(i => !i.is_completed).length,
    overdue: items.filter(i => i.due_date && isPast(new Date(i.due_date)) && !i.is_completed).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Notas & Lembretes
          </h1>
          <p className="text-muted-foreground mt-1">
            Geridos pelo Nexus Concierge
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <StickyNote className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.notes}</p>
              <p className="text-xs text-muted-foreground">Notas</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.reminders}</p>
              <p className="text-xs text-muted-foreground">Lembretes</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.overdue}</p>
              <p className="text-xs text-muted-foreground">Atrasados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar notas e lembretes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          <TabsTrigger value="reminders">Lembretes</TabsTrigger>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="completed">Concluídos</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="glass animate-pulse">
                  <CardContent className="p-4 h-20" />
                </Card>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <Card className="glass">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  {activeTab === "notes" ? (
                    <StickyNote className="w-8 h-8 text-muted-foreground" />
                  ) : (
                    <Bell className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <p className="text-muted-foreground">
                  {searchTerm 
                    ? "Nenhum resultado encontrado." 
                    : "Ainda não tens notas ou lembretes. Usa o Concierge para criar!"}
                </p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Exemplo: "Anota que tenho reunião às 15h" ou "Lembra-me de ligar ao cliente amanhã"
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredItems.map((item) => {
                const dateInfo = getDateLabel(item.due_date);
                
                return (
                  <Card 
                    key={item.id} 
                    className={`glass transition-all hover:border-primary/30 ${
                      item.is_completed ? "opacity-60" : ""
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Toggle Complete Button */}
                        <button
                          onClick={() => toggleComplete(item)}
                          className="mt-0.5 shrink-0 hover:scale-110 transition-transform"
                        >
                          {item.is_completed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground hover:text-primary" />
                          )}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {item.type === "note" ? (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary">
                                📝 Nota
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">
                                ⏰ Lembrete
                              </span>
                            )}
                            
                            {dateInfo && (
                              <span className={`px-2 py-0.5 rounded-full text-xs ${dateInfo.color}`}>
                                {dateInfo.label}
                              </span>
                            )}
                          </div>
                          
                          <p className={`text-foreground ${item.is_completed ? "line-through" : ""}`}>
                            {item.content}
                          </p>
                          
                          <p className="text-xs text-muted-foreground mt-2">
                            Criado {format(new Date(item.created_at), "d MMM 'às' HH:mm", { locale: pt })}
                            {item.due_date && (
                              <span className="ml-2">
                                • Prazo: {format(new Date(item.due_date), "d MMM 'às' HH:mm", { locale: pt })}
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteItem(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
