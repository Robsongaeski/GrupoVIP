import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Shield,
  Trash2,
} from "lucide-react";

interface SendLog {
  id: string;
  campaign_id: string;
  group_id: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  campaigns?: { name: string } | null;
  groups?: { name: string } | null;
}

interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: any;
  created_at: string;
}

interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  details: any;
  created_at: string;
  email?: string;
}

export default function AdminLogs() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("send");
  const [loading, setLoading] = useState(true);
  const [sendLogs, setSendLogs] = useState<SendLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cleaningLogs, setCleaningLogs] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user, activeTab]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case "send":
          const { data: sendData, error: sendError } = await supabase
            .from("send_logs")
            .select(`
              id, campaign_id, group_id, status, error_message, sent_at, created_at,
              campaigns (name),
              groups (name)
            `)
            .order("created_at", { ascending: false })
            .limit(100);

          if (sendError) throw sendError;
          setSendLogs(sendData || []);
          break;

        case "audit":
          const { data: auditData, error: auditError } = await supabase
            .from("admin_audit_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);

          if (auditError) throw auditError;
          setAuditLogs(auditData || []);
          break;

        case "activity":
          const { data: activityData, error: activityError } = await supabase
            .from("activity_logs")
            .select("id, user_id, action, entity_type, details, created_at")
            .order("created_at", { ascending: false })
            .limit(100);

          if (activityError) throw activityError;
          setActivityLogs(activityData || []);
          break;
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  };

  const handleCleanOldLogs = async () => {
    if (!confirm("Tem certeza que deseja limpar logs com mais de 90 dias?")) return;

    setCleaningLogs(true);
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      // Clean send_logs
      await supabase
        .from("send_logs")
        .delete()
        .lt("created_at", cutoffDate.toISOString());

      // Clean activity_logs
      await supabase
        .from("activity_logs")
        .delete()
        .lt("created_at", cutoffDate.toISOString());

      // Clean link_clicks
      await supabase
        .from("link_clicks")
        .delete()
        .lt("created_at", cutoffDate.toISOString());

      // Log the cleanup action
      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "clean_old_logs",
        details: { cutoff_date: cutoffDate.toISOString() },
      });

      toast.success("Logs antigos removidos com sucesso!");
      fetchLogs();
    } catch (error) {
      console.error("Error cleaning logs:", error);
      toast.error("Erro ao limpar logs");
    } finally {
      setCleaningLogs(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
      pending: { variant: "outline", icon: Activity },
      sent: { variant: "default", icon: CheckCircle },
      failed: { variant: "destructive", icon: XCircle },
    };
    const cfg = config[status] || config.pending;
    return (
      <Badge variant={cfg.variant} className="gap-1">
        <cfg.icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const filteredSendLogs = sendLogs.filter((log) => {
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    const matchesSearch =
      log.campaigns?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.groups?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && (searchQuery === "" || matchesSearch);
  });

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Logs do Sistema</h1>
            <p className="text-muted-foreground">
              Acompanhe envios, ações e atividades do sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchLogs}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCleanOldLogs}
              disabled={cleaningLogs}
            >
              {cleaningLogs ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Limpar +90 dias
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="send" className="gap-2">
              <Activity className="h-4 w-4" />
              Envios
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <Shield className="h-4 w-4" />
              Auditoria Admin
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Atividades
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por campanha ou grupo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="sent">Enviado</SelectItem>
                      <SelectItem value="failed">Falhou</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Campanha</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Erro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSendLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              Nenhum log encontrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredSendLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="text-sm">
                                {new Date(log.created_at).toLocaleString("pt-BR")}
                              </TableCell>
                              <TableCell>{log.campaigns?.name || "-"}</TableCell>
                              <TableCell>{log.groups?.name || "-"}</TableCell>
                              <TableCell>{getStatusBadge(log.status)}</TableCell>
                              <TableCell className="max-w-xs truncate text-sm text-destructive">
                                {log.error_message || "-"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Ação</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              Nenhum log de auditoria
                            </TableCell>
                          </TableRow>
                        ) : (
                          auditLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="text-sm">
                                {new Date(log.created_at).toLocaleString("pt-BR")}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{log.action}</Badge>
                              </TableCell>
                              <TableCell>{log.target_type || "-"}</TableCell>
                              <TableCell className="text-sm font-mono max-w-xs truncate">
                                {JSON.stringify(log.details)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Ação</TableHead>
                          <TableHead>Entidade</TableHead>
                          <TableHead>Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activityLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              Nenhuma atividade registrada
                            </TableCell>
                          </TableRow>
                        ) : (
                          activityLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="text-sm">
                                {new Date(log.created_at).toLocaleString("pt-BR")}
                              </TableCell>
                              <TableCell className="text-sm">
                                {log.user_id?.slice(0, 8) || "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{log.action}</Badge>
                              </TableCell>
                              <TableCell>{log.entity_type || "-"}</TableCell>
                              <TableCell className="text-sm font-mono max-w-xs truncate">
                                {JSON.stringify(log.details)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
