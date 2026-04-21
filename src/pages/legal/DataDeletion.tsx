import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Trash2, Shield, Clock, Loader2, AlertTriangle } from "lucide-react";
import { Helmet } from "react-helmet-async";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function DataDeletion() {
  const supportEmail = "suporte@web-business.pt";
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user-data");
      if (error) throw error;
      toast.success(data?.message ?? "Conta eliminada com sucesso.");
      await supabase.auth.signOut();
      navigate("/login?deleted=1", { replace: true });
    } catch (err) {
      console.error("[DataDeletion] erro:", err);
      toast.error("Não foi possível eliminar a conta. Contacta o suporte.");
      setDeleting(false);
    }
  };

  const subject = encodeURIComponent("Pedido de Eliminação de Dados — Nexus");
  const body = encodeURIComponent(
    `Olá,\n\nVenho por este meio solicitar a eliminação permanente de todos os dados associados à minha conta na plataforma Nexus.\n\nE-mail da conta: \nNome: \nMotivo (opcional): \n\nObrigado.`,
  );
  const mailto = `mailto:${supportEmail}?subject=${subject}&body=${body}`;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Eliminação de Dados | Nexus</title>
        <meta
          name="description"
          content="Como solicitar a eliminação dos teus dados pessoais na plataforma Nexus, em conformidade com o RGPD e as políticas da Meta."
        />
      </Helmet>

      <div className="container max-w-3xl py-12 px-4">
        <Button asChild variant="ghost" className="mb-8">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <Trash2 className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-display font-bold">Eliminação de Dados</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-10">
          Atualizado a 21 de abril de 2026
        </p>

        <div className="prose prose-invert max-w-none space-y-6">
          <p>
            Na <strong>Nexus</strong> (operada por Astrolábio Mágico Investimentos LDA) respeitamos
            o teu direito à privacidade e ao apagamento dos teus dados pessoais, conforme previsto
            no <strong>Regulamento Geral sobre a Proteção de Dados (RGPD)</strong> e nas políticas
            da Meta Platforms para integrações com Facebook, Instagram e WhatsApp Business.
          </p>

          <section>
            <h2 className="text-xl font-semibold flex items-center gap-2 mt-8 mb-3">
              <Mail className="h-5 w-5 text-primary" /> Como solicitar a eliminação
            </h2>
            <p>Tens três formas de pedir a eliminação dos teus dados:</p>

            <div className="not-prose grid gap-3 my-5">
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <p className="font-semibold text-sm mb-1 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  1. Eliminação imediata (auto-serviço)
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  {user
                    ? "Apaga já a tua conta, perfil, leads, tokens Meta/Google, campanhas e ficheiros. A ação é imediata e irreversível."
                    : "Inicia sessão para usar a eliminação imediata em auto-serviço."}
                </p>
                {user ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" disabled={deleting}>
                        {deleting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            A eliminar...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar a minha conta
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Tens a certeza absoluta?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação é <strong>irreversível</strong>. Todos os teus dados, tokens
                          e campanhas serão apagados — perfil, leads, conversações, tokens Meta
                          (Facebook/Instagram/WhatsApp) e Google, posts, sites, faturas internas
                          e ficheiros multimédia. A tua subscrição Stripe deve ser cancelada
                          separadamente em <strong>Definições → Subscrição</strong>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={deleting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleting ? "A eliminar..." : "Sim, eliminar tudo"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/login">Iniciar sessão</Link>
                  </Button>
                )}
              </div>

              <div className="rounded-lg border border-border bg-card/50 p-4">
                <p className="font-semibold text-sm mb-1">2. Por e-mail</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Envia um pedido para{" "}
                  <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                    {supportEmail}
                  </a>{" "}
                  a partir do e-mail registado na conta.
                </p>
                <Button asChild size="sm">
                  <a href={mailto}>
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar pedido por e-mail
                  </a>
                </Button>
              </div>

              <div className="rounded-lg border border-border bg-card/50 p-4">
                <p className="font-semibold text-sm mb-1">3. Por correio postal</p>
                <p className="text-sm text-muted-foreground">
                  Astrolábio Mágico Investimentos LDA<br />
                  Estrada da Malveira da Serra, 920<br />
                  Aldeia de Juso, 2750-834 Cascais, Portugal
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold flex items-center gap-2 mt-8 mb-3">
              <Shield className="h-5 w-5 text-primary" /> O que será eliminado
            </h2>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li>Dados de perfil (nome, e-mail, telefone, NIF, morada)</li>
              <li>Conteúdos criados (sites, posts, campanhas, blog, leads)</li>
              <li>Histórico de conversações com o Nexus Concierge</li>
              <li>Tokens de integração com Meta (Facebook, Instagram, WhatsApp) e Google</li>
              <li>Mensagens recebidas e enviadas via WhatsApp Business</li>
              <li>Ficheiros carregados na biblioteca multimédia</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold flex items-center gap-2 mt-8 mb-3">
              <Clock className="h-5 w-5 text-primary" /> Prazos
            </h2>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li><strong>Confirmação:</strong> até 48 horas úteis</li>
              <li><strong>Eliminação efetiva:</strong> até 30 dias após confirmação</li>
              <li><strong>Backups:</strong> purgados nos ciclos seguintes (até 90 dias)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Dados que podemos reter</h2>
            <p className="text-sm">
              Por obrigação legal (faturação, contabilidade, prevenção de fraude),
              poderemos manter um registo mínimo (NIF, faturas, transações Stripe) durante o
              período exigido pela Autoridade Tributária portuguesa (10 anos), em conformidade
              com o art. 6.º, n.º 1, alínea c) do RGPD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Integrações Meta (WhatsApp / Facebook / Instagram)</h2>
            <p className="text-sm">
              Quando solicitas a eliminação, revogamos todos os tokens de acesso à Meta Graph API,
              eliminamos as credenciais armazenadas (encriptadas com AES-256) e cessamos qualquer
              comunicação através das tuas contas. Recomendamos também que revogues a app{" "}
              <strong>Nexus</strong> em{" "}
              <a
                href="https://accounts.facebook.com/business_apps/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Facebook → Definições → Apps de Negócios
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Contacto do Encarregado de Proteção de Dados</h2>
            <p className="text-sm">
              Para qualquer questão relacionada com proteção de dados, contacta{" "}
              <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">
                {supportEmail}
              </a>
              . Tens também o direito de apresentar queixa à{" "}
              <a
                href="https://www.cnpd.pt"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Comissão Nacional de Proteção de Dados (CNPD)
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>
            Nexus © 2026 | Powered by{" "}
            <a
              href="https://web-business.pt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Web Business
            </a>{" "}
            – Um produto Astrolábio Mágico Investimentos LDA.
          </p>
          <p className="mt-1">Estrada da Malveira da Serra, 920, Aldeia de Juso, 2750-834 Cascais</p>
        </div>
      </div>
    </div>
  );
}
