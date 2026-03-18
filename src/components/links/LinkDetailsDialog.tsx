import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  MousePointer,
  Users,
  Globe,
  Calendar,
  TrendingUp,
  Loader2,
  ExternalLink,
  MapPin,
  Tag,
  Bot,
  UserCheck,
  RotateCcw,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Tooltip as TooltipUI, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface LinkDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: {
    id: string;
    name: string;
    slug: string;
    click_count: number;
    mode: "connected" | "manual" | "direct_chat";
    status: string;
    created_at: string;
  } | null;
}

interface GroupInfo {
  id: string;
  name: string;
  member_count: number;
  max_members: number;
  is_active: boolean;
  clicks: number;
}

interface ClickStats {
  totalClicks: number;
  realClicks: number;
  botClicks: number;
  uniqueIPs: number;
  totalGroups: number;
  clicksByGroup: { name: string; clicks: number }[];
  clicksByDay: { date: string; clicks: number }[];
  clicksByCountry: { country: string; clicks: number }[];
  topReferers: { referer: string; clicks: number }[];
  utmBreakdown: { source: string; clicks: number }[];
  recentClicks: {
    id: string;
    created_at: string;
    group_name: string | null;
    country: string | null;
    city: string | null;
    referer: string | null;
    is_bot: boolean;
  }[];
  linkedGroups: GroupInfo[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function LinkDetailsDialog({ open, onOpenChange, link }: LinkDetailsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [stats, setStats] = useState<ClickStats>({
    totalClicks: 0,
    realClicks: 0,
    botClicks: 0,
    uniqueIPs: 0,
    totalGroups: 0,
    clicksByGroup: [],
    clicksByDay: [],
    clicksByCountry: [],
    topReferers: [],
    utmBreakdown: [],
    recentClicks: [],
    linkedGroups: [],
  });

  const handleResetClicks = async () => {
    if (!link) return;
    
    const confirmed = window.confirm("Tem certeza que deseja zerar todos os cliques deste link? Esta ação não pode ser desfeita.");
    if (!confirmed) return;

    setResetting(true);
    try {
      // Reset click_count on intelligent_links
      const { error: updateError } = await supabase
        .from("intelligent_links")
        .update({ click_count: 0 })
        .eq("id", link.id);

      if (updateError) throw updateError;

      // Delete all link_clicks for this link
      const { error: deleteError } = await supabase
        .from("link_clicks")
        .delete()
        .eq("link_id", link.id);

      if (deleteError) throw deleteError;

      // Reset manual group clicks if applicable
      if (link.mode === "manual") {
        const { error: manualError } = await supabase
          .from("link_manual_groups")
          .update({ current_clicks: 0 })
          .eq("link_id", link.id);

        if (manualError) throw manualError;
      }

      toast.success("Cliques zerados com sucesso!");
      
      // Refresh stats
      await fetchStats(link.id);
    } catch (error) {
      console.error("Error resetting clicks:", error);
      toast.error("Erro ao zerar cliques");
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    if (open && link) {
      fetchStats(link.id);
    }
  }, [open, link]);

  const fetchStats = async (linkId: string) => {
    setLoading(true);
    try {
      // Fetch linked groups count and details
      const { data: linkedGroupsData } = await supabase
        .from("link_groups")
        .select(`
          id,
          is_active,
          groups:group_id (
            id,
            name,
            member_count,
            max_members
          )
        `)
        .eq("link_id", linkId);

      const linkedGroups: GroupInfo[] = (linkedGroupsData || []).map(lg => ({
        id: (lg.groups as any)?.id || lg.id,
        name: (lg.groups as any)?.name || "Grupo",
        member_count: (lg.groups as any)?.member_count || 0,
        max_members: (lg.groups as any)?.max_members || 1024,
        is_active: lg.is_active,
        clicks: 0,
      }));

      // Fetch all clicks for this link
      const { data: clicks, error } = await supabase
        .from("link_clicks")
        .select(`
          id,
          created_at,
          ip_address,
          country,
          city,
          referer,
          utm_source,
          utm_medium,
          utm_campaign,
          group_id,
          manual_group_id,
          is_bot,
          groups:group_id (name),
          link_manual_groups:manual_group_id (internal_name)
        `)
        .eq("link_id", linkId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!clicks || clicks.length === 0) {
        setStats({
          totalClicks: 0,
          realClicks: 0,
          botClicks: 0,
          uniqueIPs: 0,
          totalGroups: linkedGroups.length,
          clicksByGroup: [],
          clicksByDay: [],
          clicksByCountry: [],
          topReferers: [],
          utmBreakdown: [],
          recentClicks: [],
          linkedGroups,
        });
        setLoading(false);
        return;
      }

      // Separate real clicks from bot clicks
      const realClicksData = clicks.filter(c => (c as any).is_bot !== true);
      const botClicksData = clicks.filter(c => (c as any).is_bot === true);

      // Calculate stats (use only real clicks for most metrics)
      const uniqueIPs = new Set(realClicksData.map(c => c.ip_address).filter(Boolean)).size;

      // Clicks by group (real clicks only)
      const groupCounts: Record<string, number> = {};
      realClicksData.forEach(click => {
        const groupName = (click.groups as any)?.name || (click.link_manual_groups as any)?.internal_name || "Desconhecido";
        groupCounts[groupName] = (groupCounts[groupName] || 0) + 1;
      });
      const clicksByGroup = Object.entries(groupCounts)
        .map(([name, clicks]) => ({ name, clicks }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10);

      // Clicks by day (last 7 days) - real clicks only
      const daysCounts: Record<string, number> = {};
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        daysCounts[dateStr] = 0;
      }
      realClicksData.forEach(click => {
        const dateStr = click.created_at.split('T')[0];
        if (daysCounts.hasOwnProperty(dateStr)) {
          daysCounts[dateStr]++;
        }
      });
      const clicksByDay = Object.entries(daysCounts).map(([date, clicks]) => ({
        date: new Date(date).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }),
        clicks,
      }));

      // Clicks by country (real clicks only)
      const countryCounts: Record<string, number> = {};
      realClicksData.forEach(click => {
        const country = click.country || "Desconhecido";
        countryCounts[country] = (countryCounts[country] || 0) + 1;
      });
      const clicksByCountry = Object.entries(countryCounts)
        .map(([country, clicks]) => ({ country, clicks }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5);

      // Top referers (real clicks only)
      const refererCounts: Record<string, number> = {};
      realClicksData.forEach(click => {
        if (click.referer) {
          try {
            const url = new URL(click.referer);
            const domain = url.hostname;
            refererCounts[domain] = (refererCounts[domain] || 0) + 1;
          } catch {
            refererCounts[click.referer] = (refererCounts[click.referer] || 0) + 1;
          }
        }
      });
      const topReferers = Object.entries(refererCounts)
        .map(([referer, clicks]) => ({ referer, clicks }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5);

      // UTM breakdown (real clicks only)
      const utmCounts: Record<string, number> = {};
      realClicksData.forEach(click => {
        if (click.utm_source) {
          utmCounts[click.utm_source] = (utmCounts[click.utm_source] || 0) + 1;
        }
      });
      const utmBreakdown = Object.entries(utmCounts)
        .map(([source, clicks]) => ({ source, clicks }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5);

      // Recent clicks (show all, but mark bots)
      const recentClicks = clicks.slice(0, 10).map(click => ({
        id: click.id,
        created_at: click.created_at,
        group_name: (click.groups as any)?.name || (click.link_manual_groups as any)?.internal_name || null,
        country: click.country,
        city: click.city,
        referer: click.referer,
        is_bot: (click as any).is_bot === true,
      }));

      // Update linked groups with click counts
      linkedGroups.forEach(group => {
        group.clicks = groupCounts[group.name] || 0;
      });

      setStats({
        totalClicks: clicks.length,
        realClicks: realClicksData.length,
        botClicks: botClicksData.length,
        uniqueIPs,
        totalGroups: linkedGroups.length,
        clicksByGroup,
        clicksByDay,
        clicksByCountry,
        topReferers,
        utmBreakdown,
        recentClicks,
        linkedGroups,
      });
    } catch (error) {
      console.error("Error fetching link stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!link) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Detalhes do Link
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetClicks}
              disabled={resetting || loading}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {resetting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Zerar Cliques
            </Button>
          </div>
          <DialogDescription>
            {link.name} • /go/{link.slug}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Cliques Reais</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-2xl font-bold text-primary">{stats.realClicks}</p>
                    {stats.botClicks > 0 && (
                      <TooltipProvider>
                        <TooltipUI>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs gap-1 text-muted-foreground cursor-help">
                              <Bot className="h-3 w-3" />
                              +{stats.botClicks}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">
                              {stats.botClicks} cliques de bots/crawlers filtrados
                            </p>
                          </TooltipContent>
                        </TooltipUI>
                      </TooltipProvider>
                    )}
                  </div>
                  {stats.totalClicks > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round((stats.realClicks / stats.totalClicks) * 100)}% do total
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">IPs Únicos</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{stats.uniqueIPs}</p>
                  <p className="text-xs text-muted-foreground mt-1">usuários reais</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Grupos</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{stats.totalGroups}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Criado em</span>
                  </div>
                  <p className="text-sm font-medium mt-1">
                    {new Date(link.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {stats.realClicks === 0 && stats.botClicks === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MousePointer className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum clique registrado ainda</p>
                <p className="text-sm">Compartilhe seu link para começar a receber cliques</p>
              </div>
            ) : stats.realClicks === 0 && stats.botClicks > 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Apenas {stats.botClicks} cliques de bots registrados</p>
                <p className="text-sm">Ainda não há cliques de usuários reais</p>
              </div>
            ) : (
              <Tabs defaultValue="groups" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="groups">Grupos</TabsTrigger>
                  <TabsTrigger value="distribution">Cliques</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="sources">Origens</TabsTrigger>
                  <TabsTrigger value="recent">Recentes</TabsTrigger>
                </TabsList>

                <TabsContent value="groups" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Grupos Vinculados ({stats.linkedGroups.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {stats.linkedGroups.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum grupo vinculado
                          </p>
                        ) : (
                          stats.linkedGroups.map((group, index) => {
                            const capacityPercent = Math.round((group.member_count / group.max_members) * 100);
                            const isNearFull = capacityPercent >= 90;
                            const isFull = group.member_count >= group.max_members;
                            
                            return (
                              <div key={group.id} className="border rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full" 
                                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                    />
                                    <span className="font-medium text-sm truncate max-w-[200px]">
                                      {group.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {!group.is_active && (
                                      <Badge variant="secondary" className="text-xs">Inativo</Badge>
                                    )}
                                    {isFull && (
                                      <Badge variant="destructive" className="text-xs">Lotado</Badge>
                                    )}
                                    {isNearFull && !isFull && (
                                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                        Quase cheio
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    <span>{group.member_count.toLocaleString()} / {group.max_members.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <MousePointer className="h-3 w-3" />
                                    <span>{group.clicks} cliques</span>
                                  </div>
                                </div>
                                
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      isFull 
                                        ? 'bg-destructive' 
                                        : isNearFull 
                                          ? 'bg-amber-500' 
                                          : 'bg-primary'
                                    }`}
                                    style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                                  />
                                </div>
                                <p className="text-xs text-right text-muted-foreground">
                                  {capacityPercent}% de capacidade
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>
                      
                      {stats.linkedGroups.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Total de membros:</span>
                            <span className="font-bold">
                              {stats.linkedGroups.reduce((sum, g) => sum + g.member_count, 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="distribution" className="mt-4 space-y-4">
                  {stats.clicksByGroup.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Cliques por Grupo
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="w-full md:w-1/2 h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={stats.clicksByGroup}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={80}
                                  paddingAngle={2}
                                  dataKey="clicks"
                                  nameKey="name"
                                >
                                  {stats.clicksByGroup.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  formatter={(value: number) => [`${value} cliques`, '']}
                                  contentStyle={{ 
                                    backgroundColor: 'hsl(var(--background))', 
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px'
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="w-full md:w-1/2 space-y-2">
                            {stats.clicksByGroup.map((group, index) => (
                              <div key={group.name} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                  />
                                  <span className="text-sm truncate max-w-[150px]">{group.name}</span>
                                </div>
                                <Badge variant="secondary">{group.clicks}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="timeline" className="mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Cliques nos últimos 7 dias
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.clicksByDay}>
                            <XAxis 
                              dataKey="date" 
                              tick={{ fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis 
                              tick={{ fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip 
                              formatter={(value: number) => [`${value} cliques`, '']}
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--background))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                            />
                            <Bar 
                              dataKey="clicks" 
                              fill="hsl(var(--primary))" 
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="sources" className="mt-4 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {stats.clicksByCountry.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Por País
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {stats.clicksByCountry.map(item => (
                              <div key={item.country} className="flex items-center justify-between">
                                <span className="text-sm">{item.country}</span>
                                <Badge variant="secondary">{item.clicks}</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {stats.topReferers.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />
                            Referências
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {stats.topReferers.map(item => (
                              <div key={item.referer} className="flex items-center justify-between">
                                <span className="text-sm truncate max-w-[150px]">{item.referer}</span>
                                <Badge variant="secondary">{item.clicks}</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {stats.utmBreakdown.length > 0 && (
                      <Card className="md:col-span-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Tag className="h-4 w-4" />
                            UTM Sources
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {stats.utmBreakdown.map(item => (
                              <Badge key={item.source} variant="outline" className="text-sm">
                                {item.source}: {item.clicks}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {stats.clicksByCountry.length === 0 && stats.topReferers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>Dados de origem não disponíveis</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="recent" className="mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        Últimos 10 cliques
                        <Badge variant="secondary" className="text-xs gap-1">
                          <UserCheck className="h-3 w-3" />
                          Usuários reais destacados
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {stats.recentClicks.map(click => (
                          <div 
                            key={click.id} 
                            className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                              click.is_bot 
                                ? 'bg-muted/30 opacity-60' 
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="text-xs text-muted-foreground">
                                {new Date(click.created_at).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                              {click.is_bot ? (
                                <TooltipProvider>
                                  <TooltipUI>
                                    <TooltipTrigger asChild>
                                      <Badge variant="secondary" className="text-xs gap-1">
                                        <Bot className="h-3 w-3" />
                                        Bot
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">Clique de crawler/bot (não contabilizado)</p>
                                    </TooltipContent>
                                  </TooltipUI>
                                </TooltipProvider>
                              ) : (
                                <Badge variant="default" className="text-xs gap-1 bg-primary/10 text-primary border-primary/20">
                                  <UserCheck className="h-3 w-3" />
                                  Real
                                </Badge>
                              )}
                              {click.group_name && (
                                <Badge variant="outline" className="text-xs">
                                  {click.group_name}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {click.city && click.country && (
                                <span>{click.city}, {click.country}</span>
                              )}
                              {!click.city && click.country && (
                                <span>{click.country}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
