import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Mail, MapPin, Building2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseCustom";

export default function Contacto() {
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "Preenche os campos obrigatórios." });
      return;
    }

    setSending(true);

    const { error } = await supabase.from("contact_requests").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim() || null,
      message: form.message.trim(),
    });

    if (error) {
      console.error("[Contacto] Insert error:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível enviar a mensagem. Tenta novamente." });
    } else {
      toast({ title: "Mensagem enviada", description: "Entraremos em contacto em breve." });
      setForm({ name: "", email: "", subject: "", message: "" });
    }

    setSending(false);
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12 px-4">
        <Button asChild variant="ghost" className="mb-8">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>

        <h1 className="text-3xl font-display font-bold mb-8">Contacto</h1>

        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Enviar Mensagem
              </CardTitle>
              <CardDescription>Preenche o formulário e entraremos em contacto.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input id="name" value={form.name} onChange={(e) => handleChange("name", e.target.value)} maxLength={100} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} maxLength={255} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Assunto</Label>
                  <Input id="subject" value={form.subject} onChange={(e) => handleChange("subject", e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem *</Label>
                  <Textarea id="message" rows={5} value={form.message} onChange={(e) => handleChange("message", e.target.value)} maxLength={2000} required />
                </div>
                <Button type="submit" className="w-full" disabled={sending}>
                  {sending ? "A enviar..." : "Enviar Mensagem"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Email</p>
                    <a href="mailto:suporte@web-business.pt" className="text-sm text-muted-foreground hover:text-primary">suporte@web-business.pt</a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Empresa</p>
                    <p className="text-sm text-muted-foreground">Astrolábio Mágico Investimentos LDA</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Morada</p>
                    <p className="text-sm text-muted-foreground">Estrada da Malveira da Serra, 920<br />Aldeia de Juso, 2750-834 Cascais</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>
            Nexus © 2026 | Powered by{" "}
            <a href="https://web-business.pt" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Web Business
            </a>{" "}
            – Um produto Astrolábio Mágico Investimentos LDA.
          </p>
        </div>
      </div>
    </div>
  );
}
