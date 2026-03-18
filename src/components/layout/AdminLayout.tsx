import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  Shield,
  ShieldCheck,
  Settings,
  Users,
  Activity,
  LayoutDashboard,
  LogOut,
  Menu,
  ChevronRight,
  ArrowLeft,
  Package,
  CreditCard,
  Headphones,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logoVipsend from "@/assets/logo-vipsend-light.jpg";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Clientes", href: "/admin/clients", icon: Users },
  { name: "Pagamentos", href: "/admin/payments", icon: CreditCard },
  { name: "Planos", href: "/admin/plans", icon: Package },
  { name: "Suporte", href: "/admin/support", icon: Headphones },
  { name: "Usuários Admin", href: "/admin/users", icon: Shield },
  { name: "Configurações", href: "/admin/config", icon: Settings },
  { name: "Logs", href: "/admin/logs", icon: Activity },
  { name: "Testes de Segurança", href: "/admin/security", icon: ShieldCheck },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, signOut } = useAuth();
  const { isAdmin, loading } = useAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Shield className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
        <p className="text-muted-foreground mb-4">Você não tem permissão para acessar esta área.</p>
        <Button onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  const NavLinks = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={onItemClick}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
              isActive
                ? "bg-destructive/10 text-destructive"
                : "text-foreground/80 hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
            {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 lg:flex flex-col border-r bg-card">
        <div className="flex h-16 items-center gap-3 px-6 border-b">
          <div className="bg-white rounded-lg px-4 py-3 shadow-md">
            <img src={logoVipsend} alt="VIPSend" className="h-10 w-auto" />
          </div>
          <Badge variant="destructive">Admin</Badge>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3">
          <NavLinks />
        </div>

        <div className="p-4 border-t">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao App
          </Button>
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
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-16 items-center gap-3 px-6 border-b">
              <div className="bg-white rounded-lg px-4 py-3 shadow-md">
                <img src={logoVipsend} alt="VIPSend" className="h-10 w-auto" />
              </div>
              <Badge variant="destructive">Admin</Badge>
            </div>
            <div className="py-4 px-3">
              <NavLinks onItemClick={() => setMobileMenuOpen(false)} />
            </div>
            <div className="p-4 border-t">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate("/dashboard");
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao App
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex-1">
          <span className="font-semibold text-destructive">Admin SaaS</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-destructive text-destructive-foreground text-sm">
                  {user?.email ? getInitials(user.email) : "A"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Administrador</p>
            </DropdownMenuLabel>
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
