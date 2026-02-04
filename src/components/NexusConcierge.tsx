import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant" | "tool_result";
  content: string;
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  toolResult?: {
    success: boolean;
    message: string;
  };
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// Tool execution result interface
interface ToolExecutionResult {
  success: boolean;
  message: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export function NexusConcierge() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      .maybeSingle();

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
      .maybeSingle();

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

  const executeTool = async (toolName: string, toolArgs: Record<string, unknown>): Promise<ToolExecutionResult> => {
    if (!user) return { success: false, message: "Utilizador não autenticado" };

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nexus-concierge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            execute_tool: true,
            tool_name: toolName,
            tool_args: toolArgs,
            user_id: user.id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Falha na execução da ferramenta");
      }

      const result: ToolExecutionResult = await response.json();
      
      // Show toast notification for feedback
      if (result.success) {
        toast.success(getToolSuccessTitle(toolName), {
          description: result.message,
          duration: 4000,
        });
      } else {
        toast.error("Ação não concluída", {
          description: result.message,
          duration: 4000,
        });
      }
      
      return result;
    } catch (error) {
      console.error("Tool execution error:", error);
      toast.error("Erro de execução", {
        description: "Não foi possível executar a ação. Tente novamente.",
        duration: 4000,
      });
      return { success: false, message: "Erro ao executar ação" };
    }
  };

  // Get friendly title for toast based on tool name
  const getToolSuccessTitle = (toolName: string): string => {
    const titles: Record<string, string> = {
      create_lead: "Lead criado! 🎉",
      add_note_to_lead: "Nota adicionada! 📝",
      add_note: "Nota guardada! 📝",
      set_reminder: "Lembrete definido! ⏰",
      save_site_progress: "Progresso guardado! 💾",
    };
    return titles[toolName] || "Ação concluída! ✅";
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
          body: JSON.stringify({ 
            messages: updatedMessages.filter(m => m.role !== "tool_result").map(m => ({
              role: m.role === "tool_result" ? "assistant" : m.role,
              content: m.content
            }))
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let toolCalls: ToolCall[] = [];
      let currentToolCall: Partial<ToolCall> | null = null;

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
                const delta = parsed.choices?.[0]?.delta;
                
                // Handle regular content
                if (delta?.content) {
                  assistantContent += delta.content;
                  setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (last?.role === "assistant" && !last.toolCall) {
                      return prev.map((m, i) =>
                        i === prev.length - 1 ? { ...m, content: assistantContent } : m
                      );
                    }
                    return [...prev, { role: "assistant", content: assistantContent }];
                  });
                }

                // Handle tool calls
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (tc.index !== undefined) {
                      if (!toolCalls[tc.index]) {
                        toolCalls[tc.index] = {
                          id: tc.id || "",
                          type: "function",
                          function: { name: "", arguments: "" }
                        };
                      }
                      if (tc.id) toolCalls[tc.index].id = tc.id;
                      if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name;
                      if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                    }
                  }
                }
              } catch {
                // Ignore parsing errors for incomplete chunks
              }
            }
          }
        }
      }

      // Process tool calls if any
      if (toolCalls.length > 0) {
        setIsExecutingTool(true);
        
        for (const tc of toolCalls) {
          if (tc.function.name && tc.function.arguments) {
            try {
              const args = JSON.parse(tc.function.arguments);
              
              // Show tool call in progress
              setMessages(prev => [...prev, {
                role: "assistant",
                content: `A executar: ${tc.function.name}...`,
                toolCall: { name: tc.function.name, args }
              }]);

              // Execute the tool
              const result = await executeTool(tc.function.name, args);
              
              // Update with result
              setMessages(prev => {
                const newMessages = prev.slice(0, -1);
                return [...newMessages, {
                  role: "tool_result",
                  content: result.message,
                  toolResult: result
                }];
              });

              // Get follow-up response from AI
              const followUpMessages = [
                ...updatedMessages,
                { role: "assistant" as const, content: `Executei ${tc.function.name} com resultado: ${result.message}` }
              ];

              const followUpResponse = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nexus-concierge`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                  },
                  body: JSON.stringify({ 
                    messages: followUpMessages.map(m => ({
                      role: m.role,
                      content: m.content
                    }))
                  }),
                }
              );

              if (followUpResponse.ok) {
                const followUpReader = followUpResponse.body?.getReader();
                let followUpContent = "";

                if (followUpReader) {
                  while (true) {
                    const { done, value } = await followUpReader.read();
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
                            followUpContent += content;
                            setMessages((prev) => {
                              const last = prev[prev.length - 1];
                              if (last?.role === "assistant" && !last.toolCall && !last.toolResult) {
                                return prev.map((m, i) =>
                                  i === prev.length - 1 ? { ...m, content: followUpContent } : m
                                );
                              }
                              return [...prev, { role: "assistant", content: followUpContent }];
                            });
                          }
                        } catch {}
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.error("Tool call parse error:", e);
            }
          }
        }
        
        setIsExecutingTool(false);
      }

      // Save final conversation
      setMessages(prev => {
        saveConversationHistory(prev);
        return prev;
      });
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
                    Assistente Executivo com IA
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
                  Posso criar leads, guardar notas, definir lembretes e guardar o seu site.
                </p>
                <div className="mt-4 text-xs text-muted-foreground/70 space-y-1">
                  <p>💡 "Cria um lead chamado João Silva"</p>
                  <p>💡 "Anota que preciso rever orçamentos"</p>
                  <p>💡 "Lembrete amanhã às 10h para ligar ao cliente"</p>
                  <p>💡 "Guarda o progresso do site Imobiliária Luxo"</p>
                </div>
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
                      : message.role === "tool_result"
                      ? message.toolResult?.success
                        ? "bg-green-500/20 text-green-300 rounded-bl-md border border-green-500/30"
                        : "bg-red-500/20 text-red-300 rounded-bl-md border border-red-500/30"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {message.role === "tool_result" ? (
                    <div className="flex items-center gap-2 text-sm">
                      {message.toolResult?.success ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      <span>{message.content}</span>
                    </div>
                  ) : message.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            {(isLoading || isExecutingTool) && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">
                    {isExecutingTool ? "A executar ação..." : "A pensar..."}
                  </span>
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
                placeholder="Cria um lead, adiciona nota..."
                className="flex-1 bg-muted border-0"
                disabled={isLoading || isExecutingTool}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading || isExecutingTool}
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