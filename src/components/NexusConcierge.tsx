import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Sparkles, Loader2, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// Lovable Cloud edge function URL (auto-deployed on Publish)
const CONCIERGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nexus-concierge`;
const OPEN_CONCIERGE_EVENT = "nexus-concierge:open";

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

interface ToolExecutionResult {
  success: boolean;
  message: string;
}

interface ActionButton {
  label: string;
  actionType: string;
  params: string;
}

interface UserContext {
  company_name?: string;
  business_sector?: string;
  plan_type?: string;
  project_name?: string;
  domain?: string;
  leads_count?: number;
  ai_custom_instructions?: string;
  trial_days_left?: number;
}

interface ConciergeOpenDetail {
  prompt?: string;
}

function isExplicitNavigationRequest(content?: string): boolean {
  if (!content) return false;

  const normalized = content
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return [
    "leva-me",
    "leva me",
    "abre",
    "vai para",
    "ir para",
    "navega",
    "mostra-me",
    "mostra me",
    "encaminha-me",
    "encaminha me",
  ].some((phrase) => normalized.includes(phrase));
}

// Parse action buttons from message content
function parseActionButtons(content: string): { cleanContent: string; buttons: ActionButton[] } {
  const buttonRegex = /\[ACTION:([^:]+):([^:]+):([^\]]+)\]/g;
  const buttons: ActionButton[] = [];
  let match;

  while ((match = buttonRegex.exec(content)) !== null) {
    buttons.push({
      label: match[1].trim(),
      actionType: match[2].trim(),
      params: match[3].trim(),
    });
  }

  const cleanContent = content.replace(buttonRegex, "").trim();
  return { cleanContent, buttons };
}

// Parse natural language dates (moved from edge function)
function parseNaturalDate(dateStr: string): string | null {
  const now = new Date();
  const lowerDate = dateStr.toLowerCase();

  if (lowerDate.includes("amanhã") || lowerDate.includes("amanha")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    const timeMatch = lowerDate.match(/(\d{1,2})[h:.]?(\d{2})?/);
    if (timeMatch) {
      d.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2] || "0"), 0);
    } else {
      d.setHours(9, 0, 0);
    }
    return d.toISOString();
  }

  if (lowerDate.includes("hoje")) {
    const d = new Date(now);
    const timeMatch = lowerDate.match(/(\d{1,2})[h:.]?(\d{2})?/);
    if (timeMatch) {
      d.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2] || "0"), 0);
    }
    return d.toISOString();
  }

  const dayMap: Record<string, number> = {
    domingo: 0, segunda: 1, "terça": 2, terca: 2, quarta: 3,
    quinta: 4, sexta: 5, "sábado": 6, sabado: 6,
  };

  for (const [dayName, dayNum] of Object.entries(dayMap)) {
    if (lowerDate.includes(dayName)) {
      const d = new Date(now);
      const currentDay = d.getDay();
      let daysToAdd = dayNum - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      d.setDate(d.getDate() + daysToAdd);
      const timeMatch = lowerDate.match(/(\d{1,2})[h:.]?(\d{2})?/);
      if (timeMatch) {
        d.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2] || "0"), 0);
      } else {
        d.setHours(10, 0, 0);
      }
      return d.toISOString();
    }
  }

  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch { /* ignore */ }

  return null;
}

export function NexusConcierge() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [hasLoadedProactive, setHasLoadedProactive] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleOpenConcierge = (event: Event) => {
      const customEvent = event as CustomEvent<ConciergeOpenDetail>;
      setIsOpen(true);
      if (customEvent.detail?.prompt) {
        setInput(customEvent.detail.prompt);
      }
    };

    window.addEventListener(OPEN_CONCIERGE_EVENT, handleOpenConcierge as EventListener);
    return () => {
      window.removeEventListener(OPEN_CONCIERGE_EVENT, handleOpenConcierge as EventListener);
    };
  }, []);

  useEffect(() => {
    if (user && isOpen) {
      loadUserContext();
      loadConversationHistory();
    }
  }, [user, isOpen]);

  // Fetch user context from external DB to send to the edge function
  const loadUserContext = async () => {
    if (!user) return;

    try {
      const [profileRes, projectRes, subscriptionRes, leadsRes] = await Promise.all([
        supabase.from("profiles").select("business_sector, company_name, ai_custom_instructions").eq("user_id", user.id).maybeSingle(),
        supabase.from("projects").select("name, domain, selected_plan, trial_expires_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("subscriptions").select("plan_type, status, trial_ends_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      const profile = profileRes.data;
      const project = projectRes.data;
      const subscription = subscriptionRes.data;

      let trialDaysLeft: number | undefined;
      if (project?.trial_expires_at) {
        const trialEnd = new Date(project.trial_expires_at);
        trialDaysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      }

      setUserContext({
        company_name: profile?.company_name || undefined,
        business_sector: profile?.business_sector || undefined,
        plan_type: subscription?.plan_type || project?.selected_plan || "Lite",
        project_name: project?.name || undefined,
        domain: project?.domain || undefined,
        leads_count: leadsRes.count ?? 0,
        ai_custom_instructions: profile?.ai_custom_instructions || undefined,
        trial_days_left: trialDaysLeft,
      });
    } catch (error) {
      console.error("Error loading user context:", error);
    }
  };

  const generateProactiveInsight = useCallback(async () => {
    if (!user || hasLoadedProactive) return;
    setHasLoadedProactive(true);

    try {
      const projectsRes = await supabase.from("projects").select("id", { count: "exact", head: true });
      const projectCount = projectsRes.count ?? 0;

      let proactiveMessage = "";

      if (projectCount === 0) {
        proactiveMessage = `Bem-vindo ao WB Nexus! 🚀\n\nSou o teu **Success Concierge** — o teu mentor estratégico.\n\nDiz-me o **setor do teu negócio** (ex: Cafetaria, Imobiliária, Salão de Beleza) e eu ajudo-te a começar!\n\nVamos começar?`;
      } else {
        proactiveMessage = `Olá! 👋 Sou o teu **Success Concierge**. Estou pronto para te ajudar a crescer o teu negócio.\n\nO que precisas hoje? 🎯\n\n[ACTION:Criar Conteúdo:generate_draft:instagram]\n[ACTION:Registar Cliente:create_lead:default]\n[ACTION:Ver Estratégia:navigate:/strategy]`;
      }

      setMessages([{ role: "assistant", content: proactiveMessage }]);
    } catch (error) {
      console.error("Error generating proactive insight:", error);
      setMessages([{ role: "assistant", content: "Olá! 👋 Sou o teu **Success Concierge**. Como posso ajudar-te hoje?" }]);
    }
  }, [user, hasLoadedProactive]);

  const loadConversationHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("concierge_conversations" as string)
        .select("messages")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.messages && (data.messages as Message[]).length > 0) {
        setMessages(data.messages as Message[]);
      } else {
        generateProactiveInsight();
      }
    } catch {
      generateProactiveInsight();
    }
  };

  const saveConversationHistory = async (newMessages: Message[]) => {
    if (!user) return;

    try {
      const { data: existing } = await supabase
        .from("concierge_conversations" as string)
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("concierge_conversations" as string)
          .update({ messages: newMessages, updated_at: new Date().toISOString() } as Record<string, unknown>)
          .eq("id", (existing as Record<string, unknown>).id);
      } else {
        await supabase
          .from("concierge_conversations" as string)
          .insert({ user_id: user.id, messages: newMessages } as Record<string, unknown>);
      }
    } catch {
      // Silently fail if table doesn't exist
    }
  };

  // ============ LOCAL TOOL EXECUTION (uses external DB directly) ============

  const executeTool = async (toolName: string, toolArgs: Record<string, unknown>): Promise<ToolExecutionResult> => {
    if (!user) return { success: false, message: "Utilizador não autenticado" };

    try {
      switch (toolName) {
        case "create_lead":
          return await executeCreateLead(toolArgs);
        case "add_note_to_lead":
          return await executeAddNoteToLead(toolArgs);
        case "add_note":
          return await executeAddNote(toolArgs);
        case "set_reminder":
          return await executeSetReminder(toolArgs);
        case "generate_instagram_draft":
          return await executeGenerateInstagramDraft(toolArgs);
        default:
          return { success: false, message: `Ferramenta "${toolName}" não reconhecida` };
      }
    } catch (error) {
      console.error("Tool execution error:", error);
      return { success: false, message: "Erro ao executar ação" };
    }
  };

  const executeCreateLead = async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const { name, email, phone, notes } = args as { name: string; email?: string; phone?: string; notes?: string };
    const { error } = await supabase.from("leads").insert({
      name, email: email || null, phone: phone || null, notes: notes || null,
      user_id: user!.id, status: "novo",
    });
    if (error) return { success: false, message: `Erro ao criar lead: ${error.message}` };
    toast.success("Potencial cliente criado! 🎉");
    return { success: true, message: `Lead "${name}" criado com sucesso!` };
  };

  const executeAddNoteToLead = async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const { lead_name, note } = args as { lead_name: string; note: string };
    const { data: leads } = await supabase
      .from("leads").select("id, notes").eq("user_id", user!.id)
      .ilike("name", `%${lead_name}%`).limit(1);

    if (leads && leads.length > 0) {
      const existingNotes = leads[0].notes || "";
      const newNotes = existingNotes
        ? `${existingNotes}\n\n[${new Date().toLocaleDateString("pt-PT")}] ${note}`
        : `[${new Date().toLocaleDateString("pt-PT")}] ${note}`;
      const { error } = await supabase.from("leads").update({ notes: newNotes }).eq("id", leads[0].id);
      if (error) return { success: false, message: `Erro ao adicionar nota: ${error.message}` };
      toast.success("Nota adicionada! 📝");
      return { success: true, message: `Nota adicionada ao lead "${lead_name}"` };
    }
    return { success: false, message: `Lead "${lead_name}" não encontrado` };
  };

  const executeAddNote = async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const { content } = args as { content: string };
    const { error } = await supabase.from("notes_reminders").insert({
      user_id: user!.id, type: "note", content,
    });
    if (error) return { success: false, message: `Erro ao guardar nota: ${error.message}` };
    toast.success("Nota guardada! 📝");
    return { success: true, message: `Nota guardada: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"` };
  };

  const executeSetReminder = async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const { lead_name, task, due_date } = args as { lead_name?: string; task: string; due_date: string };
    const parsedDate = parseNaturalDate(due_date) || due_date;

    if (lead_name) {
      const { data: leads } = await supabase
        .from("leads").select("id, notes").eq("user_id", user!.id)
        .ilike("name", `%${lead_name}%`).limit(1);

      if (leads && leads.length > 0) {
        const existingNotes = leads[0].notes || "";
        const reminderNote = `\n\n[LEMBRETE ${new Date(parsedDate).toLocaleString("pt-PT")}] ${task}`;
        const { error } = await supabase
          .from("leads")
          .update({ reminder_date: parsedDate, notes: existingNotes + reminderNote })
          .eq("id", leads[0].id);
        if (error) return { success: false, message: `Erro ao definir lembrete: ${error.message}` };
        toast.success("Lembrete definido! ⏰");
        return { success: true, message: `Lembrete definido para "${lead_name}" em ${new Date(parsedDate).toLocaleString("pt-PT")}` };
      }
      return { success: false, message: `Lead "${lead_name}" não encontrado` };
    }

    const { error } = await supabase.from("notes_reminders").insert({
      user_id: user!.id, type: "reminder", content: task, due_date: parsedDate,
    });
    if (error) return { success: false, message: `Erro ao criar lembrete: ${error.message}` };
    toast.success("Lembrete definido! ⏰");
    return { success: true, message: `Lembrete criado para ${new Date(parsedDate).toLocaleString("pt-PT")}: "${task}"` };
  };

  const executeGenerateInstagramDraft = async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
    const { topic, count = 1, platform = "instagram" } = args as { topic: string; count?: number; platform?: string };
    // This tool requires AI generation, which happens on the edge function side.
    // We save a simple draft with the topic as caption.
    const postCount = Math.min(Math.max(1, count), 5);
    const savedPosts: string[] = [];

    for (let i = 0; i < postCount; i++) {
      const caption = `📝 Rascunho sobre "${topic}" — edita na Presença no Instagram`;
      const { error } = await supabase.from("social_posts").insert({
        user_id: user!.id,
        platform,
        caption,
        hashtags: [],
        status: "draft",
      });
      if (!error) savedPosts.push(caption);
    }

    if (savedPosts.length === 0) {
      return { success: false, message: "Erro ao guardar os rascunhos." };
    }

    toast.success(`${savedPosts.length} rascunho(s) criado(s)! ✨`);
    return {
      success: true,
      message: `✨ ${savedPosts.length} rascunho${savedPosts.length > 1 ? "s" : ""} criado${savedPosts.length > 1 ? "s" : ""}! Vai à Presença no Instagram para editar e publicar.`,
    };
  };

  // ============ AI CHAT (calls Lovable Cloud) ============

  const handleActionButton = async (button: ActionButton) => {
    if (button.actionType === "navigate") {
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
      const userExplicitlyAskedToNavigate = isExplicitNavigationRequest(lastUserMessage?.content);

      if (!userExplicitlyAskedToNavigate) {
        toast.info("O Concierge só muda de página quando pedires explicitamente.");
        setInput(`Leva-me para ${button.label}`);
        return;
      }

      const confirmed = window.confirm(`Queres ir para ${button.label}? Vais sair desta página.`);
      if (confirmed) {
        navigate(button.params);
      }
      return;
    }

    if (button.actionType === "generate_draft") {
      setInput(`Gera um post de ${button.params} sobre `);
      return;
    }

    if (button.actionType === "create_lead") {
      setInput("Regista o potencial cliente ");
      return;
    }

    if (button.actionType === "set_reminder") {
      setInput("Lembra-me de ");
      return;
    }

    setInput(button.label);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const chatMessages = updatedMessages
        .filter(m => m.role !== "tool_result")
        .map(m => ({
          role: m.role === "tool_result" ? "assistant" : m.role,
          content: m.content
        }));

      console.log("[Concierge] Sending to:", CONCIERGE_URL);
      console.log("[Concierge] Messages count:", chatMessages.length);

      const response = await fetch(CONCIERGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: chatMessages,
          user_context: userContext,
        }),
      });

      console.log("[Concierge] Response status:", response.status, "Content-Type:", response.headers.get("content-type"));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Concierge] Error response:", errorText);
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch { /* not JSON */ }
        throw new Error(errorMessage);
      }

      // Check if streaming or JSON response
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        // Stream response
        await handleStreamResponse(response, updatedMessages);
      } else {
        // JSON response (single message or non-streaming)
        const data = await response.json();
        console.log("[Concierge] JSON response:", JSON.stringify(data).substring(0, 200));
        const choice = data.choices?.[0];

        if (choice?.message?.tool_calls) {
          await handleToolCalls(choice.message.tool_calls, updatedMessages);
        } else {
          const aiContent = choice?.message?.content || data.response || "Desculpe, não consegui responder.";
          setMessages(prev => [...prev, { role: "assistant", content: aiContent }]);
        }
      }

      // Save conversation
      setMessages(prev => {
        saveConversationHistory(prev);
        return prev;
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("[Concierge] Error:", errMsg, error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠️ Erro: ${errMsg}\n\nTenta novamente ou recarrega a página.`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStreamResponse = async (response: Response, updatedMessages: Message[]) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let assistantContent = "";
    const toolCalls: ToolCall[] = [];

    if (!reader) return;

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

            if (delta?.content) {
              assistantContent += delta.content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && !last.toolCall) {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }

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

    // Process tool calls locally
    if (toolCalls.length > 0) {
      await handleToolCalls(toolCalls.map(tc => ({
        id: tc.id,
        type: tc.type,
        function: tc.function,
      })), updatedMessages);
    }
  };

  const handleToolCalls = async (
    toolCalls: Array<{ id?: string; type?: string; function: { name: string; arguments: string } }>,
    updatedMessages: Message[]
  ) => {
    setIsExecutingTool(true);

    for (const tc of toolCalls) {
      if (tc.function.name && tc.function.arguments) {
        try {
          const args = JSON.parse(tc.function.arguments);

          setMessages(prev => [...prev, {
            role: "assistant",
            content: `A executar: ${getToolFriendlyName(tc.function.name)}...`,
            toolCall: { name: tc.function.name, args }
          }]);

          const result = await executeTool(tc.function.name, args);

          setMessages(prev => {
            const newMessages = prev.slice(0, -1);
            return [...newMessages, {
              role: "tool_result",
              content: result.message,
              toolResult: result
            }];
          });

          // Follow-up: ask AI to comment on the result
          const followUpMessages = [
            ...updatedMessages.map(m => ({ role: m.role === "tool_result" ? "assistant" : m.role, content: m.content })),
            { role: "assistant", content: `Executei ${tc.function.name} com resultado: ${result.message}` }
          ];

          try {
            const followUpResponse = await fetch(CONCIERGE_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                messages: followUpMessages,
                user_context: userContext,
              }),
            });

            if (followUpResponse.ok) {
              const followUpContentType = followUpResponse.headers.get("content-type") || "";

              if (followUpContentType.includes("text/event-stream")) {
                const followUpReader = followUpResponse.body?.getReader();
                let followUpContent = "";
                const decoder = new TextDecoder();

                if (followUpReader) {
                  while (true) {
                    const { done, value } = await followUpReader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    for (const line of chunk.split("\n")) {
                      if (line.startsWith("data: ")) {
                        const jsonStr = line.slice(6).trim();
                        if (jsonStr === "[DONE]") continue;
                        try {
                          const parsed = JSON.parse(jsonStr);
                          const content = parsed.choices?.[0]?.delta?.content;
                          if (content) {
                            followUpContent += content;
                            setMessages(prev => {
                              const last = prev[prev.length - 1];
                              if (last?.role === "assistant" && !last.toolCall && !last.toolResult) {
                                return prev.map((m, i) =>
                                  i === prev.length - 1 ? { ...m, content: followUpContent } : m
                                );
                              }
                              return [...prev, { role: "assistant", content: followUpContent }];
                            });
                          }
                        } catch { /* ignore */ }
                      }
                    }
                  }
                }
              } else {
                const data = await followUpResponse.json();
                const aiContent = data.choices?.[0]?.message?.content || "";
                if (aiContent) {
                  setMessages(prev => [...prev, { role: "assistant", content: aiContent }]);
                }
              }
            }
          } catch {
            // Follow-up failed, that's OK — tool was already executed
          }
        } catch (e) {
          console.error("Tool call parse error:", e);
        }
      }
    }

    setIsExecutingTool(false);
  };

  const getToolFriendlyName = (toolName: string): string => {
    const names: Record<string, string> = {
      create_lead: "Registar potencial cliente",
      add_note_to_lead: "Adicionar nota",
      add_note: "Guardar nota",
      set_reminder: "Definir lembrete",
      generate_instagram_draft: "Gerar rascunhos",
    };
    return names[toolName] || toolName;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = async () => {
    setMessages([]);
    setHasLoadedProactive(false);
    if (user) {
      try {
        await supabase
          .from("concierge_conversations" as string)
          .delete()
          .eq("user_id", user.id);
      } catch { /* ignore */ }
    }
  };

  // Render a message with action buttons extracted
  const renderMessageContent = (message: Message) => {
    if (message.role === "tool_result") {
      return (
        <div className="flex items-center gap-2 text-sm">
          {message.toolResult?.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.content}</span>
        </div>
      );
    }

    if (message.role === "assistant") {
      const { cleanContent, buttons } = parseActionButtons(message.content);
      const lastUserMessage = [...messages].reverse().find((entry) => entry.role === "user");
      const userExplicitlyAskedToNavigate = isExplicitNavigationRequest(lastUserMessage?.content);
      const visibleButtons = buttons.filter(
        (button) => button.actionType !== "navigate" || userExplicitlyAskedToNavigate
      );

      return (
        <div>
          {cleanContent && (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown>{cleanContent}</ReactMarkdown>
            </div>
          )}
          {visibleButtons.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {visibleButtons.map((btn, i) => (
                <button
                  key={i}
                  onClick={() => handleActionButton(btn)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                    "transition-all duration-200 hover:scale-105",
                    btn.actionType === "navigate"
                      ? "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30"
                      : "bg-accent/80 text-accent-foreground hover:bg-accent border border-accent/50"
                  )}
                >
                  <Zap className="w-3 h-3" />
                  {btn.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    return <p className="text-sm">{message.content}</p>;
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
            "w-96 h-[520px] max-w-[calc(100vw-3rem)]",
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
                    O teu colaborador de negócio
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
                  Olá! Sou o teu Concierge Nexus.
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  Posso criar conteúdo, registar clientes e gerir o teu negócio.
                </p>
                <div className="mt-4 text-xs text-muted-foreground/70 space-y-1">
                  <p>💡 "Regista o João Silva como potencial cliente"</p>
                  <p>💡 "Cria 3 posts para o Instagram"</p>
                  <p>💡 "Lembra-me de ligar ao cliente amanhã"</p>
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
                    "max-w-[85%] rounded-2xl px-4 py-2",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : message.role === "tool_result"
                      ? message.toolResult?.success
                        ? "bg-green-500/20 text-green-300 rounded-bl-md border border-green-500/30"
                        : "bg-red-500/20 text-red-300 rounded-bl-md border border-red-500/30"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {renderMessageContent(message)}
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
                placeholder="Diz-me o que precisas..."
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
