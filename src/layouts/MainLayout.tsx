import { Outlet, Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NexusConcierge } from "@/components/NexusConcierge";
import { DynamicSEOHead } from "@/components/seo/DynamicSEOHead";
import { GoogleAnalytics } from "@/components/seo/GoogleAnalytics";

export default function MainLayout() {
  const { signOut, user } = useAuth();

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
                  NEXUS<span className="text-foreground">AI</span>
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:block">
                {user?.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <div className="flex-1 p-6 overflow-auto">
            <Outlet />
          </div>
          <footer className="border-t border-border px-6 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacidade</Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-foreground transition-colors">Termos</Link>
            <span>·</span>
            <Link to="/devolucoes" className="hover:text-foreground transition-colors">Devoluções</Link>
            <span>·</span>
            <Link to="/contacto" className="hover:text-foreground transition-colors">Contacto</Link>
          </footer>
        </main>
        <NexusConcierge />
        <DynamicSEOHead />
        <GoogleAnalytics />
      </div>
    </SidebarProvider>
  );
}
