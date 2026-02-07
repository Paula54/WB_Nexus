import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { MessageCircle, Flame, Send, User } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import TrialExpiredBanner from "@/components/TrialExpiredBanner";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  ai_classification: string | null;
}

interface Message {
  id: string;
  lead_id: string;
  sender_type: string;
  message_text: string;
  created_at: string;
}

export default function WhatsAppInbox() {
  const { user } = useAuth();
  const trial = useTrialStatus();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, [user]);

  useEffect(() => {
    if (selectedLead) {
      fetchMessages(selectedLead.id);
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel(`messages-${selectedLead.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "conversation_messages",
            filter: `lead_id=eq.${selectedLead.id}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as Message]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedLead]);

  async function fetchLeads() {
    if (!user) return;

    const { data, error } = await supabase
      .from("leads")
      .select("id, name, phone, ai_classification")
      .not("phone", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching leads:", error);
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  }

  async function fetchMessages(leadId: string) {
    const { data, error } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
    } else {
      setMessages(data || []);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLead || !newMessage.trim()) return;

    if (trial.isExpired) {
      toast({
        variant: "destructive",
        title: "Subscrição Necessária",
        description: "O teu período experimental expirou. Ativa a subscrição para enviar mensagens.",
      });
      return;
    }

    setSending(true);

    try {
      // Save message to database
      const { error: dbError } = await supabase.from("conversation_messages").insert({
        lead_id: selectedLead.id,
        sender_type: "user",
        message_text: newMessage,
      });

      if (dbError) throw dbError;

      // Call edge function to send via Twilio
      const { error: funcError } = await supabase.functions.invoke("send-whatsapp-reply", {
        body: {
          leadId: selectedLead.id,
          message: newMessage,
          phone: selectedLead.phone,
        },
      });

      if (funcError) {
        console.error("Error sending via Twilio:", funcError);
        // Still show message locally even if Twilio fails
      }

      setNewMessage("");
      toast({
        title: "Mensagem enviada",
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível enviar a mensagem.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="flex flex-col h-full">
        {trial.isExpired && <div className="mb-4"><TrialExpiredBanner plan={trial.plan} /></div>}
        <div className="mb-4">
          <h1 className="text-3xl font-display font-bold text-foreground">WhatsApp Inbox</h1>
          <p className="text-muted-foreground mt-1">
            Conversas com potenciais clientes via WhatsApp
          </p>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
          {/* Leads List */}
          <Card className="glass overflow-hidden">
            <CardContent className="p-0 h-full flex flex-col">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold">Conversas</h3>
              </div>
              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : leads.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Nenhuma conversa</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {leads.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className={cn(
                          "w-full p-3 rounded-lg text-left transition-colors",
                          selectedLead?.id === lead.id
                            ? "bg-primary/20 border border-primary/50"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{lead.name}</span>
                          {lead.ai_classification === "hot" && (
                            <Flame className="h-4 w-4 text-orange-500" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{lead.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="glass overflow-hidden md:col-span-2">
            <CardContent className="p-0 h-full flex flex-col">
              {selectedLead ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-border flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        {selectedLead.name}
                        {selectedLead.ai_classification === "hot" && (
                          <Flame className="h-4 w-4 text-orange-500" />
                        )}
                      </h3>
                      <span className="text-xs text-muted-foreground">{selectedLead.phone}</span>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <p className="text-sm">Sem mensagens ainda</p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "max-w-[80%] p-3 rounded-lg",
                            msg.sender_type === "user"
                              ? "ml-auto bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm">{msg.message_text}</p>
                          <span className="text-xs opacity-70 mt-1 block">
                            {format(new Date(msg.created_at), "HH:mm", { locale: pt })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input */}
                  <form onSubmit={sendMessage} className="p-4 border-t border-border">
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escreva uma mensagem..."
                        disabled={sending}
                      />
                      <Button type="submit" disabled={sending || !newMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4" />
                    <p>Selecione uma conversa</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
