import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Globe,
  Share2,
  Search,
  MessageCircle,
  Settings,
  Zap,
  Sparkles,
  StickyNote,
  Users,
  Megaphone,
  CreditCard,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { PageType } from "@/types/nexus";

const menuItems = [
  { title: "Centro de Comando", url: "/", icon: LayoutDashboard, type: PageType.DASHBOARD },
  { title: "Site Builder", url: "/builder", icon: Globe, type: PageType.BUILDER },
  { title: "Estratégia AI", url: "/strategy", icon: Sparkles, type: PageType.STRATEGY },
  { title: "Gestão de Vendas", url: "/crm", icon: Users },
  { title: "Agenda & Notas", url: "/notes", icon: StickyNote },
  { title: "Presença no Instagram", url: "/social-media", icon: Share2, type: PageType.SOCIAL },
  { title: "Anúncios", url: "/ads", icon: Megaphone },
  { title: "Visibilidade no Google", url: "/seo", icon: Search, type: PageType.SEO },
  { title: "WhatsApp Inbox", url: "/whatsapp", icon: MessageCircle, type: PageType.WHATSAPP },
];

const bottomItems = [
  { title: "Plano & Subscrição", url: "/settings/subscription", icon: CreditCard },
  { title: "Identidade da Marca", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-3 px-4 py-6 border-b border-sidebar-border",
          collapsed && "justify-center px-2"
        )}>
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center animate-pulse-glow">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="font-display font-bold text-lg text-sidebar-primary">
                NEXUS<span className="text-sidebar-foreground">AI</span>
              </h2>
              <p className="text-xs text-sidebar-foreground/60">Centro de Comando</p>
            </div>
          )}
        </div>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className={cn(collapsed && "sr-only")}>
            Plataforma
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-primary font-medium"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto mb-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-primary font-medium"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
