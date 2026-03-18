import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
  DollarSign,
  Activity,
  UserPlus,
  Package,
} from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardStats {
  totalClients: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  suspendedSubscriptions: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  newClientsThisWeek: number;
  pendingPayments: number;
  connectedInstances: number;
  disconnectedInstances: number;
}

interface RecentActivity {
  id: string;
  type: "new_client" | "payment" | "subscription_change" | "instance_status";
  title: string;
  description: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [
        { count: totalClients },
        { data: subscriptions },
        { data: paymentsThisMonth },
        { data: paymentsLastMonth },
        { count: newClientsThisWeek },
        { data: instances },
        { data: recentPayments },
        { data: recentProfiles },
      ] = await Promise.all([
        // Total clients
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        // Subscriptions by status
        supabase.from("subscriptions").select("status"),
        // Revenue this month
        supabase
          .from("payments")
          .select("amount")
          .gte("paid_at", startOfMonth(new Date()).toISOString())
          .eq("status", "approved"),
        // Revenue last month
        supabase
          .from("payments")
          .select("amount")
          .gte("paid_at", startOfMonth(subDays(new Date(), 30)).toISOString())
          .lt("paid_at", startOfMonth(new Date()).toISOString())
          .eq("status", "approved"),
        // New clients this week
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("created_at", subDays(new Date(), 7).toISOString()),
        // WhatsApp instances
        supabase.from("whatsapp_instances").select("status"),
        // Recent payments for activity
        supabase
          .from("payments")
          .select("id, amount, status, created_at, payer_email")
          .order("created_at", { ascending: false })
          .limit(5),
        // Recent signups for activity
        supabase
          .from("profiles")
          .select("id, email, full_name, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      // Calculate stats
      const activeCount = subscriptions?.filter((s) => s.status === "active").length || 0;
      const trialCount = subscriptions?.filter((s) => s.status === "trial").length || 0;
      const suspendedCount = subscriptions?.filter((s) => s.status === "suspended" || s.status === "cancelled").length || 0;
      const pendingCount = subscriptions?.filter((s) => s.status === "payment_pending").length || 0;

      const revenueThisMonth = paymentsThisMonth?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const revenueLastMonth = paymentsLastMonth?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      const connectedInstances = instances?.filter((i) => i.status === "connected").length || 0;
      const disconnectedInstances = instances?.filter((i) => i.status !== "connected").length || 0;

      setStats({
        totalClients: totalClients || 0,
        activeSubscriptions: activeCount,
        trialSubscriptions: trialCount,
        suspendedSubscriptions: suspendedCount,
        revenueThisMonth,
        revenueLastMonth,
        newClientsThisWeek: newClientsThisWeek || 0,
        pendingPayments: pendingCount,
        connectedInstances,
        disconnectedInstances,
      });

      // Build recent activity
      const activities: RecentActivity[] = [];

      recentProfiles?.forEach((profile) => {
        activities.push({
          id: `profile-${profile.id}`,
          type: "new_client",
          title: "Novo cliente",
          description: profile.full_name || profile.email,
          timestamp: profile.created_at,
        });
      });

      recentPayments?.forEach((payment) => {
        activities.push({
          id: `payment-${payment.id}`,
          type: "payment",
          title: payment.status === "approved" ? "Pagamento aprovado" : "Pagamento pendente",
          description: `R$ ${(payment.amount / 100).toFixed(2)} - ${payment.payer_email || "N/A"}`,
          timestamp: payment.created_at,
        });
      });

      // Sort by timestamp and take latest 8
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activities.slice(0, 8));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getRevenueChange = () => {
    if (!stats || stats.revenueLastMonth === 0) return null;
    const change = ((stats.revenueThisMonth - stats.revenueLastMonth) / stats.revenueLastMonth) * 100;
    return change;
  };

  const getActivityIcon = (type: RecentActivity["type"]) => {
    switch (type) {
      case "new_client":
        return <UserPlus className="h-4 w-4 text-green-500" />;
      case "payment":
        return <CreditCard className="h-4 w-4 text-blue-500" />;
      case "subscription_change":
        return <Package className="h-4 w-4 text-orange-500" />;
      case "instance_status":
        return <Activity className="h-4 w-4 text-purple-500" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Admin</h1>
            <p className="text-muted-foreground">Visão geral do sistema</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  const revenueChange = getRevenueChange();

  return (
    <AdminLayout>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Admin</h1>
        <p className="text-muted-foreground">Visão geral do sistema</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalClients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +{stats?.newClientsThisWeek} esta semana
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receita do Mês</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.revenueThisMonth || 0)}</div>
            {revenueChange !== null && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${revenueChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                <TrendingUp className={`h-3 w-3 ${revenueChange < 0 ? "rotate-180" : ""}`} />
                {revenueChange >= 0 ? "+" : ""}{revenueChange.toFixed(1)}% vs mês anterior
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assinaturas Ativas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeSubscriptions}</div>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {stats?.trialSubscriptions} trial
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Atenção Necessária</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pagamentos pendentes</span>
                <Badge variant={stats?.pendingPayments ? "destructive" : "secondary"}>
                  {stats?.pendingPayments}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Suspensos</span>
                <Badge variant={stats?.suspendedSubscriptions ? "destructive" : "secondary"}>
                  {stats?.suspendedSubscriptions}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status das Assinaturas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Ativas</span>
                </div>
                <span className="font-medium">{stats?.activeSubscriptions}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Trial</span>
                </div>
                <span className="font-medium">{stats?.trialSubscriptions}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Pagamento Pendente</span>
                </div>
                <span className="font-medium">{stats?.pendingPayments}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Suspensos/Cancelados</span>
                </div>
                <span className="font-medium">{stats?.suspendedSubscriptions}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Instâncias WhatsApp</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm">Conectadas</span>
                </div>
                <span className="font-medium">{stats?.connectedInstances}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <span className="text-sm">Desconectadas</span>
                </div>
                <span className="font-medium">{stats?.disconnectedInstances}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link to="/admin/clients">
                  Ver todos os clientes
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link to="/admin/payments">
                  Ver pagamentos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link to="/admin/plans">
                  Gerenciar planos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
          <CardDescription>Últimos eventos do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhuma atividade recente</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4">
                  <div className="flex-shrink-0 p-2 rounded-full bg-muted">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(activity.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </AdminLayout>
  );
}
