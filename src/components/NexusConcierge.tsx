import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function NexusConcierge() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation history on mount
  useEffect(() => {
    if (user && isOpen) {
      loadConversationHistory();
    }
  }, [user, isOpen]);

  const loadConversationHistory = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("concierge_conversations")
      .select("messages")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (data?.messages) {
      setMessages(data.messages as Message[]);
    }
  };

  const saveConversationHistory = async (newMessages: Message[]) => {
    if (!user) return;

    const { data: existing } = await supabase
      .from("concierge_conversations")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (existing) {
      await supabase
        .from("concierge_conversations")
        .update({ messages: newMessages, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("concierge_conversations")
        .insert({ user_id: user.id, messages: newMessages });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nexus-concierge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: updatedMessages }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  assistantContent += content;
                  setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (last?.role === "assistant") {
                      return prev.map((m, i) =>
                        i === prev.length - 1
                          ? { ...m, content: assistantContent }
                          : m
                      );
                    }
                    return [...prev, { role: "assistant", content: assistantContent }];
                  });
                }
              } catch {
                // Ignore parsing errors for incomplete chunks
              }
            }
          }
        }
      }

      const finalMessages = [
        ...updatedMessages,
        { role: "assistant" as const, content: assistantContent },
      ];
      await saveConversationHistory(finalMessages);
    } catch (error) {
      console.error("Concierge error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Desculpe, ocorreu um erro. Por favor, tente novamente.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = async () => {
    setMessages([]);
    if (user) {
      await supabase
        .from("concierge_conversations")
        .delete()
        .eq("user_id", user.id);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg",
          "bg-primary text-primary-foreground",
          "flex items-center justify-center",
          "hover:scale-110 transition-all duration-300",
          "animate-pulse-glow"
        )}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-50",
            "w-96 h-[500px] max-w-[calc(100vw-3rem)]",
            "bg-card border border-border rounded-2xl shadow-2xl",
            "flex flex-col overflow-hidden",
            "animate-scale-in"
          )}
        >
          {/* Header */}
          <div className="p-4 border-b border-border bg-primary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">
                    Nexus Concierge
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Seu assistente executivo
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Sparkles className="w-12 h-12 mx-auto text-primary/40 mb-4" />
                <p className="text-muted-foreground text-sm">
                  Olá! Sou o seu Concierge Nexus.
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  Como posso ajudá-lo hoje?
                </p>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escreva a sua mensagem..."
                className="flex-1 bg-muted border-0"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
