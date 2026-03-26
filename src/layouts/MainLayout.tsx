import { Outlet, Link, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useLegalConsent } from "@/hooks/useLegalConsent";
import { LegalConsentModal } from "@/components/LegalConsentModal";
import { LogOut, Menu, User, Building2, CreditCard, Wallet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NexusConcierge } from "@/components/NexusConcierge";
import { DynamicSEOHead } from "@/components/seo/DynamicSEOHead";
import { GoogleAnalytics } from "@/components/seo/GoogleAnalytics";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export default function MainLayout() {
  const { signOut, user } = useAuth();
  const { profile } = useProfile();
  const { hasConsented, loading: consentLoading, acceptConsent } = useLegalConsent();
  const navigate = useNavigate();

  const showConsentModal = !consentLoading && hasConsented === false;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-16 border-b border-border flex items-center justify-between px-4 glass sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <div className="hidden md:block">
                <h1 className="font-display text-lg font-semibold text-primary">
                  NEXUS<span className="text-foreground">Machine</span>
                </h1>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-full px-2 py-1.5 hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
                  <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-foreground hidden sm:block max-w-[140px] truncate">
                    {profile?.full_name || user?.email?.split("@")[0] || "Perfil"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile?.full_name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  O Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                  <Building2 className="mr-2 h-4 w-4" />
                  Perfil da Empresa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings/subscription")} className="cursor-pointer">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Planos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings/credits")} className="cursor-pointer">
                  <Wallet className="mr-2 h-4 w-4" />
                  Carteira AI Fuel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings/invoices")} className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  Faturas
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Terminar Sessão
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <div className="flex-1 p-6 overflow-auto">
            <Outlet />
          </div>
          <footer className="border-t border-border px-6 py-4 flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacidade</Link>
              <span>·</span>
              <Link to="/terms" className="hover:text-foreground transition-colors">Termos</Link>
              <span>·</span>
              <Link to="/devolucoes" className="hover:text-foreground transition-colors">Devoluções</Link>
              <span>·</span>
              <Link to="/contacto" className="hover:text-foreground transition-colors">Contacto</Link>
            </div>
            <p>Nexus Machine © 2026 | Powered by <a href="https://web-business.pt" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Web Business</a> – Um produto Astrolábio Mágico Investimentos LDA.</p>
          </footer>
        </main>
        <NexusConcierge />
        <DynamicSEOHead />
        <GoogleAnalytics />
        <LegalConsentModal open={showConsentModal} onAccept={acceptConsent} />
      </div>
    </SidebarProvider>
  );
}
