import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  Smartphone,
  Users,
  Link,
  Megaphone,
  Settings,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string | null;
  created_at: string;
  details: unknown;
}

const actionLabels: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  create_instance: { label: "Instância criada", icon: Smartphone, color: "text-primary" },
  connect_instance: { label: "Instância conectada", icon: Smartphone, color: "text-success" },
  disconnect_instance: { label: "Instância desconectada", icon: Smartphone, color: "text-warning" },
  sync_groups: { label: "Grupos sincronizados", icon: Users, color: "text-info" },
  create_link: { label: "Link criado", icon: Link, color: "text-primary" },
  create_campaign: { label: "Campanha criada", icon: Megaphone, color: "text-primary" },
  send_campaign: { label: "Campanha enviada", icon: Megaphone, color: "text-success" },
  update_profile: { label: "Perfil atualizado", icon: Settings, color: "text-muted-foreground" },
};

export function RecentActivityCard() {
  const { user } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchActivities();
    }
  }, [user, effectiveUserId]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, action, entity_type, created_at, details")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionInfo = (action: string) => {
    return actionLabels[action] || { label: action, icon: Activity, color: "text-muted-foreground" };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Atividade Recente
        </CardTitle>
        <CardDescription>Últimas ações realizadas</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Nenhuma atividade recente</p>
            <p className="text-sm text-muted-foreground">
              Comece conectando uma instância
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const info = getActionInfo(activity.action);
              const Icon = info.icon;

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={`p-2 rounded-full bg-muted ${info.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{info.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  {activity.entity_type && (
                    <Badge variant="outline" className="text-xs">
                      {activity.entity_type}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
