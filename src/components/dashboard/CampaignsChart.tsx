import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Megaphone, Loader2 } from "lucide-react";

interface ChartData {
  status: string;
  label: string;
  count: number;
  color: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "hsl(var(--muted-foreground))" },
  scheduled: { label: "Agendada", color: "hsl(var(--info))" },
  running: { label: "Enviando", color: "hsl(var(--warning))" },
  completed: { label: "Concluída", color: "hsl(var(--success))" },
  cancelled: { label: "Cancelada", color: "hsl(var(--destructive))" },
};

export function CampaignsChart() {
  const { user } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (user) {
      fetchCampaignsData();
    }
  }, [user, effectiveUserId]);

  const fetchCampaignsData = async () => {
    try {
      const { data: campaigns, error } = await supabase
        .from("campaigns")
        .select("status")
        .eq("user_id", effectiveUserId);

      if (error) throw error;

      // Count by status
      const countByStatus = (campaigns || []).reduce((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const chartData: ChartData[] = Object.entries(statusConfig).map(([status, config]) => ({
        status,
        label: config.label,
        count: countByStatus[status] || 0,
        color: config.color,
      }));

      setData(chartData);
      setTotal(campaigns?.length || 0);
    } catch (error) {
      console.error("Error fetching campaigns data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Campanhas
            </CardTitle>
            <CardDescription>Por status</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">total</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : total === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-center">
            <div>
              <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Nenhuma campanha criada</p>
              <p className="text-sm text-muted-foreground">Crie sua primeira campanha</p>
            </div>
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-2">
                          <p className="font-medium">{payload[0].payload.label}</p>
                          <p className="text-sm">{payload[0].value} campanhas</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
