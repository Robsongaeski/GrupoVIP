import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Loader2, Bot, UserCheck } from "lucide-react";
import { format, subDays, eachDayOfInterval, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip as TooltipUI, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface ChartData {
  date: string;
  clicks: number;
  label: string;
}

export function ClicksChart() {
  const { user } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalClicks, setTotalClicks] = useState(0);
  const [realClicks, setRealClicks] = useState(0);
  const [botClicks, setBotClicks] = useState(0);

  useEffect(() => {
    if (user) {
      fetchClicksData();
    }
  }, [user, effectiveUserId]);

  const fetchClicksData = async () => {
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, 30);

      // Get all link IDs for the user
      const { data: links, error: linksError } = await supabase
        .from("intelligent_links")
        .select("id")
        .eq("user_id", effectiveUserId);

      if (linksError) throw linksError;

      const linkIds = links?.map((l) => l.id) || [];

      if (linkIds.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Get clicks for those links (only real clicks, excluding bots)
      const { data: clicks, error: clicksError } = await supabase
        .from("link_clicks")
        .select("created_at, is_bot")
        .in("link_id", linkIds)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (clicksError) throw clicksError;

      // Separate real clicks from bot clicks
      const realClicksData = clicks?.filter(c => c.is_bot !== true) || [];
      const botClicksData = clicks?.filter(c => c.is_bot === true) || [];

      // Create a map of dates to click counts (only real clicks for the chart)
      const clicksByDate = new Map<string, number>();

      // Initialize all days with 0
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      days.forEach((day) => {
        clicksByDate.set(format(day, "yyyy-MM-dd"), 0);
      });

      // Count clicks per day (only real clicks)
      realClicksData.forEach((click) => {
        const dateKey = format(startOfDay(parseISO(click.created_at)), "yyyy-MM-dd");
        clicksByDate.set(dateKey, (clicksByDate.get(dateKey) || 0) + 1);
      });

      // Convert to chart data
      const chartData: ChartData[] = Array.from(clicksByDate.entries()).map(([date, count]) => ({
        date,
        clicks: count,
        label: format(parseISO(date), "dd/MM", { locale: ptBR }),
      }));

      setData(chartData);
      setTotalClicks(clicks?.length || 0);
      setRealClicks(realClicksData.length);
      setBotClicks(botClicksData.length);
    } catch (error) {
      console.error("Error fetching clicks data:", error);
    } finally {
      setLoading(false);
    }
  };

  const realClicksPercent = totalClicks > 0 ? Math.round((realClicks / totalClicks) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Cliques nos Links
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              Últimos 30 dias
              <TooltipProvider>
                <TooltipUI>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs gap-1 cursor-help">
                      <UserCheck className="h-3 w-3" />
                      Usuários reais
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[250px]">
                    <p className="text-xs">
                      O gráfico mostra apenas cliques de usuários reais. 
                      Bots e crawlers (Facebook, Google, WhatsApp preview) são filtrados automaticamente.
                    </p>
                  </TooltipContent>
                </TooltipUI>
              </TooltipProvider>
            </CardDescription>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-2 justify-end">
              <p className="text-2xl font-bold text-primary">{realClicks}</p>
              {botClicks > 0 && (
                <TooltipProvider>
                  <TooltipUI>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs gap-1 text-muted-foreground cursor-help">
                        <Bot className="h-3 w-3" />
                        +{botClicks}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        {botClicks} cliques de bots/crawlers filtrados
                      </p>
                    </TooltipContent>
                  </TooltipUI>
                </TooltipProvider>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              cliques reais {realClicksPercent > 0 && `(${realClicksPercent}%)`}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-center">
            <div>
              <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Nenhum clique registrado</p>
              <p className="text-sm text-muted-foreground">Crie links para começar a rastrear</p>
            </div>
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={30} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-2">
                          <p className="font-medium">{payload[0].payload.label}</p>
                          <p className="text-sm text-primary">{payload[0].value} cliques reais</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#clicksGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
