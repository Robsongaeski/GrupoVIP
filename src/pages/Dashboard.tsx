import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { UsageLimitsCard } from "@/components/dashboard/UsageLimitsCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { ClicksChart } from "@/components/dashboard/ClicksChart";
import { CampaignsChart } from "@/components/dashboard/CampaignsChart";
import { GroupMembersChart } from "@/components/dashboard/GroupMembersChart";
import {
  Smartphone,
  Users,
  Link as LinkIcon,
  Megaphone,
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  UserPlus,
  MousePointerClick,
  Calendar,
} from "lucide-react";

interface Stats {
  instances: number;
  connectedInstances: number;
  groups: number;
  groupsWithVacancy: number;
  links: number;
  activeLinks: number;
  campaigns: number;
  activeCampaigns: number;
  scheduledCampaigns: number;
  totalClicks: number;
  totalMembers: number;
  clicksLast7Days: number;
  membersGrowth7Days: number;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    instances: 0,
    connectedInstances: 0,
    groups: 0,
    groupsWithVacancy: 0,
    links: 0,
    activeLinks: 0,
    campaigns: 0,
    activeCampaigns: 0,
    scheduledCampaigns: 0,
    totalClicks: 0,
    totalMembers: 0,
    clicksLast7Days: 0,
    membersGrowth7Days: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user, effectiveUserId]);

  const fetchStats = async () => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [
        instancesRes, 
        groupsRes, 
        linksRes, 
        campaignsRes,
        clicksLast7DaysRes,
      ] = await Promise.all([
        supabase.from("whatsapp_instances").select("id, status").eq("user_id", effectiveUserId),
        supabase.from("groups").select("id, member_count, max_members, is_active").eq("user_id", effectiveUserId),
        supabase.from("intelligent_links").select("id, click_count, status").eq("user_id", effectiveUserId),
        supabase.from("campaigns").select("id, status, scheduled_at").eq("user_id", effectiveUserId),
        supabase.from("link_clicks")
          .select("id, link_id")
          .gte("created_at", sevenDaysAgo.toISOString())
          .in("link_id", (await supabase.from("intelligent_links").select("id").eq("user_id", effectiveUserId)).data?.map(l => l.id) || []),
      ]);

      const instances = instancesRes.data || [];
      const groups = groupsRes.data || [];
      const links = linksRes.data || [];
      const campaigns = campaignsRes.data || [];

      const connectedInstances = instances.filter(i => i.status === 'connected').length;
      const activeGroups = groups.filter(g => g.is_active);
      const groupsWithVacancy = activeGroups.filter(g => (g.member_count || 0) < (g.max_members || 1024)).length;
      const totalMembers = activeGroups.reduce((acc, g) => acc + (g.member_count || 0), 0);
      const totalClicks = links.reduce((acc, l) => acc + (l.click_count || 0), 0);
      const activeLinks = links.filter(l => l.status === 'active').length;
      const activeCampaigns = campaigns.filter(c => c.status === 'running').length;
      const scheduledCampaigns = campaigns.filter(c => c.status === 'scheduled').length;
      const clicksLast7Days = clicksLast7DaysRes.data?.length || 0;

      setStats({
        instances: instances.length,
        connectedInstances,
        groups: activeGroups.length,
        groupsWithVacancy,
        links: links.length,
        activeLinks,
        campaigns: campaigns.length,
        activeCampaigns,
        scheduledCampaigns,
        totalClicks,
        totalMembers,
        clicksLast7Days,
        membersGrowth7Days: 0, // Would need historical data
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const statCards = [
    {
      title: "Campanhas",
      value: stats.campaigns,
      icon: Megaphone,
      href: "/dashboard/campaigns",
      color: "text-primary",
      bgColor: "bg-primary/10",
      badge: stats.activeCampaigns > 0 ? (
        <Badge variant="default" className="text-xs">
          {stats.activeCampaigns} ativa{stats.activeCampaigns > 1 ? 's' : ''}
        </Badge>
      ) : stats.scheduledCampaigns > 0 ? (
        <Badge variant="secondary" className="text-xs">
          {stats.scheduledCampaigns} agendada{stats.scheduledCampaigns > 1 ? 's' : ''}
        </Badge>
      ) : null,
    },
    {
      title: "Links Inteligentes",
      value: stats.links,
      icon: LinkIcon,
      href: "/dashboard/links",
      color: "text-warning",
      bgColor: "bg-warning/10",
      badge: (
        <Badge variant="outline" className="text-xs">
          {stats.activeLinks} ativo{stats.activeLinks !== 1 ? 's' : ''}
        </Badge>
      ),
    },
    {
      title: "Grupos",
      value: stats.groups,
      icon: Users,
      href: "/dashboard/groups",
      color: "text-info",
      bgColor: "bg-info/10",
      badge: (
        <Badge variant="outline" className="text-xs">
          {stats.groupsWithVacancy} com vagas
        </Badge>
      ),
    },
    {
      title: "Instâncias",
      value: stats.instances,
      icon: Smartphone,
      href: "/dashboard/instances",
      color: stats.connectedInstances === stats.instances && stats.instances > 0 ? "text-success" : "text-warning",
      bgColor: stats.connectedInstances === stats.instances && stats.instances > 0 ? "bg-success/10" : "bg-warning/10",
      badge: (
        <Badge 
          variant={stats.connectedInstances === stats.instances && stats.instances > 0 ? "default" : "destructive"} 
          className="text-xs"
        >
          {stats.connectedInstances}/{stats.instances} online
        </Badge>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Visão geral do seu sistema
            </p>
          </div>
          <Button onClick={() => navigate("/dashboard/campaigns")}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Campanha
          </Button>
        </div>

        {/* Quick Stats Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card
              key={stat.title}
              className="group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              onClick={() => navigate(stat.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold">
                    {loading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      stat.value
                    )}
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-2">
                  {stat.badge}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Total Members */}
          <Card className="border-l-4 border-l-info">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Membros</p>
                  <p className="text-2xl font-bold mt-1">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.totalMembers.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Em {stats.groups} grupos ativos
                  </p>
                </div>
                <div className="p-3 rounded-full bg-info/10">
                  <UserPlus className="h-6 w-6 text-info" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Clicks */}
          <Card className="border-l-4 border-l-warning">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cliques nos Links</p>
                  <p className="text-2xl font-bold mt-1">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.totalClicks.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-success" />
                    {stats.clicksLast7Days} nos últimos 7 dias
                  </p>
                </div>
                <div className="p-3 rounded-full bg-warning/10">
                  <MousePointerClick className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scheduled Campaigns */}
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Campanhas Pendentes</p>
                  <p className="text-2xl font-bold mt-1">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.activeCampaigns + stats.scheduledCampaigns}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {stats.scheduledCampaigns} agendadas, {stats.activeCampaigns} em execução
                  </p>
                </div>
                <div className="p-3 rounded-full bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Status Alert */}
        {stats.instances > 0 && stats.connectedInstances < stats.instances && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">
                    {stats.instances - stats.connectedInstances} instância{stats.instances - stats.connectedInstances > 1 ? 's' : ''} desconectada{stats.instances - stats.connectedInstances > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Reconecte para continuar enviando campanhas
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => navigate("/dashboard/instances")}>
                  Verificar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Group Members Evolution Chart - Full Width */}
        <GroupMembersChart />

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <ClicksChart />
          <CampaignsChart />
        </div>

        {/* Usage and Activity Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <UsageLimitsCard />
          <RecentActivityCard />
        </div>

        {/* Quick Actions - Only show if user needs setup */}
        {(stats.instances === 0 || stats.groups === 0 || stats.links === 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Começar Agora
              </CardTitle>
              <CardDescription>
                Complete a configuração do seu sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className={`flex items-center gap-4 p-4 rounded-lg border ${stats.instances > 0 ? 'bg-success/5 border-success/20' : 'bg-muted/50'}`}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${stats.instances > 0 ? 'bg-success text-success-foreground' : 'bg-primary text-primary-foreground'} text-sm font-bold`}>
                    {stats.instances > 0 ? <CheckCircle2 className="h-4 w-4" /> : '1'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Conecte uma instância WhatsApp</p>
                    <p className="text-sm text-muted-foreground">
                      {stats.instances > 0 ? `${stats.connectedInstances} conectada${stats.connectedInstances > 1 ? 's' : ''}` : 'Configure sua Evolution API'}
                    </p>
                  </div>
                  {stats.instances === 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("/dashboard/instances")}
                    >
                      Configurar
                    </Button>
                  )}
                </div>

                <div className={`flex items-center gap-4 p-4 rounded-lg border ${stats.groups > 0 ? 'bg-success/5 border-success/20' : 'bg-muted/50'}`}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${stats.groups > 0 ? 'bg-success text-success-foreground' : 'bg-primary text-primary-foreground'} text-sm font-bold`}>
                    {stats.groups > 0 ? <CheckCircle2 className="h-4 w-4" /> : '2'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Sincronize seus grupos</p>
                    <p className="text-sm text-muted-foreground">
                      {stats.groups > 0 ? `${stats.groups} grupo${stats.groups > 1 ? 's' : ''} sincronizado${stats.groups > 1 ? 's' : ''}` : 'Importe grupos automaticamente'}
                    </p>
                  </div>
                  {stats.groups === 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("/dashboard/groups")}
                    >
                      Ver Grupos
                    </Button>
                  )}
                </div>

                <div className={`flex items-center gap-4 p-4 rounded-lg border ${stats.links > 0 ? 'bg-success/5 border-success/20' : 'bg-muted/50'}`}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${stats.links > 0 ? 'bg-success text-success-foreground' : 'bg-primary text-primary-foreground'} text-sm font-bold`}>
                    {stats.links > 0 ? <CheckCircle2 className="h-4 w-4" /> : '3'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Crie links inteligentes</p>
                    <p className="text-sm text-muted-foreground">
                      {stats.links > 0 ? `${stats.links} link${stats.links > 1 ? 's' : ''} criado${stats.links > 1 ? 's' : ''}` : 'Distribua membros automaticamente'}
                    </p>
                  </div>
                  {stats.links === 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("/dashboard/links")}
                    >
                      Criar Link
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
