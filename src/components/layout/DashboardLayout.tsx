import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Smartphone,
  Users,
  Link as LinkIcon,
  Megaphone,
  Settings,
  Shield,
  LogOut,
  Menu,
  ChevronRight,
  Settings2,
  BarChart2,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PaymentRequiredOverlay from "./PaymentRequiredOverlay";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import logoVipsend from "@/assets/logo-vipsend-dark.png";
import { NotificationBadge } from "@/components/support/NotificationBadge";

// Menu organizado por frequência de uso
const mainNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Campanhas", href: "/dashboard/campaigns", icon: Megaphone },
  { name: "Links Inteligentes", href: "/dashboard/links", icon: LinkIcon },
];

// Itens de configuração inicial (usados raramente após setup)
const setupNavigation = [
  { name: "Instâncias", href: "/dashboard/instances", icon: Smartphone },
  { name: "Grupos", href: "/dashboard/groups", icon: Users },
  { name: "Ações de Grupo", href: "/dashboard/group-actions", icon: Settings2 },
  { name: "Pixel Meta", href: "/dashboard/settings/pixel", icon: BarChart2 },
];

const settingsNavigation = [
  { name: "Configurações", href: "/dashboard/settings", icon: Settings },
  { name: "Ajuda & Suporte", href: "/dashboard/support", icon: HelpCircle, showBadge: true },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { isImpersonating } = useImpersonation();
  const { requiresPayment, isSuspended, loading: subscriptionLoading } = useSubscription();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Show payment overlay if subscription requires payment (but not when impersonating)
  const showPaymentOverlay = !subscriptionLoading && !isImpersonating && (requiresPayment || isSuspended);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const NavLinks = ({ onItemClick }: { onItemClick?: () => void }) => {
    const renderNavItem = (item: typeof mainNavigation[0] & { showBadge?: boolean }) => {
      const isActive = location.pathname === item.href || 
        (item.href === "/dashboard/support" && location.pathname.startsWith("/dashboard/support"));
      return (
        <Link
          key={item.name}
          to={item.href}
          onClick={onItemClick}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          <item.icon className="h-5 w-5" />
          {item.name}
          {item.showBadge && <NotificationBadge className="ml-auto" />}
          {isActive && !item.showBadge && <ChevronRight className="ml-auto h-4 w-4" />}
        </Link>
      );
    };

    return (
      <nav className="flex flex-col gap-1">
        {/* Menu Principal */}
        {mainNavigation.map(renderNavItem)}
        
        {/* Separador e Seção de Setup */}
        <div className="mt-4 mb-2 px-4">
          <span className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            Configuração
          </span>
        </div>
        {setupNavigation.map(renderNavItem)}
        
        {/* Separador e Configurações */}
        <div className="mt-4 border-t border-sidebar-border pt-4">
          {settingsNavigation.map(renderNavItem)}
        </div>
      </nav>
    );
  };

  return (
    <div className={cn("min-h-screen bg-background", isImpersonating && "pt-10")}>
      {/* Impersonation Banner */}
      <ImpersonationBanner />
      {/* Payment Required Overlay */}
      {showPaymentOverlay && <PaymentRequiredOverlay />}
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 lg:flex flex-col gradient-primary">
        <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
          <div className="bg-white rounded-lg px-4 py-3 shadow-md">
            <img src={logoVipsend} alt="VIPSend" className="h-12 w-auto" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3">
          <NavLinks />
        </div>

        <div className="p-4 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 px-2 w-full rounded-lg hover:bg-sidebar-accent/50 py-2 transition-colors">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                    {user?.email ? getInitials(user.email) : "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {user?.email}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuLabel>
                <p className="text-sm font-medium truncate">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Minha conta
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Shield className="mr-2 h-4 w-4" />
                    Painel Admin
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-40 lg:hidden flex h-16 items-center gap-4 border-b bg-background px-4">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 gradient-primary">
            <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
              <div className="bg-white rounded-lg px-4 py-3 shadow-md">
                <img src={logoVipsend} alt="VIPSend" className="h-12 w-auto" />
              </div>
            </div>
            <div className="py-4 px-3">
              <NavLinks onItemClick={() => setMobileMenuOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {user?.email ? getInitials(user.email) : "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/admin")}>
                  <Shield className="mr-2 h-4 w-4" />
                  Painel Admin
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="min-h-[calc(100vh-4rem)] lg:min-h-screen p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
