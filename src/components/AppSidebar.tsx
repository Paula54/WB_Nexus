import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Globe,
  Share2,
  Search,
  MessageCircle,
  Zap,
  Megaphone,
  Mail,
  BarChart3,
  Headphones,
  Users,
  CalendarDays,
  Briefcase,
  UserCheck,
  BookOpen,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
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

const sidebarGroups = [
  {
    label: "Operações",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Site Builder", url: "/builder", icon: Globe },
      { title: "Domínios", url: "/domains", icon: Globe },
      { title: "CRM", url: "/crm", icon: Users },
      { title: "Agenda", url: "/notes", icon: CalendarDays },
    ],
  },
  {
    label: "Crescimento",
    items: [
      { title: "Anúncios", url: "/ads", icon: Megaphone },
      { title: "SEO & Google", url: "/seo", icon: Search },
      { title: "Blog", url: "/blog", icon: BookOpen },
      { title: "Redes Sociais", url: "/social-media", icon: Share2 },
      { title: "Email Marketing", url: "/marketing", icon: Mail },
      { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
      { title: "Desempenho", url: "/performance", icon: BarChart3 },
    ],
  },
  {
    label: "Apoio",
    items: [
      { title: "Suporte AI", url: "/strategy", icon: Headphones },
    ],
  },
  {
    label: "Administração",
    items: [
      { title: "Gestão de Tarefas", url: "/admin", icon: UserCheck },
    ],
    adminOnly: true,
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isFreelancer, isAdmin } = useUserRole();

  const dynamicGroups = isFreelancer
    ? [
        {
          label: "Freelancer",
          items: [
            { title: "Meus Projetos", url: "/freelancer-dashboard", icon: Briefcase },
          ],
        },
      ]
    : sidebarGroups.filter((g) => !(g as any).adminOnly || isAdmin);

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
                NEXUS<span className="text-sidebar-foreground">Machine</span>
              </h2>
              <p className="text-xs text-sidebar-foreground/60">Centro de Comando</p>
            </div>
          )}
        </div>

        {dynamicGroups.map((group) => {
          const hasActive = group.items.some((item) => location.pathname === item.url);
          return (
            <SidebarGroup key={group.label} className="mt-2" defaultOpen={hasActive || group.label === "Operações"}>
              <SidebarGroupLabel className={cn("text-xs uppercase tracking-wider", collapsed && "sr-only")}>
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.url}>
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
                            <item.icon className="w-4 h-4 shrink-0" />
                            {!collapsed && <span className="text-sm">{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
