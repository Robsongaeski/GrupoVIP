import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  ArrowLeft,
  Type,
  FileText,
  Image,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  PlayCircle,
  Calendar,
  Settings2,
} from "lucide-react";

interface GroupActionTarget {
  id: string;
  group_id: string;
  status: "pending" | "executing" | "completed" | "failed" | "cancelled";
  executed_at: string | null;
  error_message: string | null;
  groups: {
    id: string;
    name: string;
    description: string | null;
    photo_url: string | null;
  } | null;
}

interface GroupAction {
  id: string;
  action_type: "name" | "description" | "photo";
  new_value_text: string | null;
  new_value_file_url: string | null;
  scheduled_at: string;
  status: "pending" | "executing" | "completed" | "failed" | "cancelled";
  executed_at: string | null;
  error_message: string | null;
  created_at: string;
  whatsapp_instance_id: string;
  whatsapp_instances: { name: string } | null;
}

interface GroupSnapshot {
  id: string;
  group_id: string;
  action_id: string | null;
  name_before: string | null;
  description_before: string | null;
  photo_url_before: string | null;
  created_at: string;
  groups: { name: string } | null;
}

export default function GroupActionDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [action, setAction] = useState<GroupAction | null>(null);
  const [targets, setTargets] = useState<GroupActionTarget[]>([]);
  const [snapshots, setSnapshots] = useState<GroupSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchData();
    }
  }, [user, id]);

  const fetchData = async () => {
    if (!id) return;

    try {
      const [actionResult, targetsResult, snapshotsResult] = await Promise.all([
        supabase
          .from("group_actions")
          .select(`
            *,
            whatsapp_instances (name)
          `)
          .eq("id", id)
          .eq("user_id", user?.id)
          .single(),
        supabase
          .from("group_action_targets")
          .select(`
            *,
            groups (id, name, description, photo_url)
          `)
          .eq("action_id", id)
          .order("created_at"),
        supabase
          .from("group_snapshots")
          .select(`
            *,
            groups (name)
          `)
          .eq("action_id", id)
          .order("created_at", { ascending: false })
      ]);

      if (actionResult.error) throw actionResult.error;
      if (targetsResult.error) throw targetsResult.error;
      if (snapshotsResult.error) throw snapshotsResult.error;

      setAction(actionResult.data as unknown as GroupAction);
      setTargets(targetsResult.data as unknown as GroupActionTarget[] || []);
      setSnapshots(snapshotsResult.data as unknown as GroupSnapshot[] || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (snapshot: GroupSnapshot) => {
    if (!action || !user) return;

    setReverting(snapshot.id);

    try {
      // Create a new action to revert to previous state
      const { data: revertAction, error: revertError } = await supabase
        .from("group_actions")
        .insert({
          user_id: user.id,
          whatsapp_instance_id: action.whatsapp_instance_id,
          action_type: action.action_type,
          new_value_text: action.action_type === "name" 
            ? snapshot.name_before 
            : action.action_type === "description" 
              ? snapshot.description_before 
              : null,
          new_value_file_url: action.action_type === "photo" ? snapshot.photo_url_before : null,
          scheduled_at: new Date().toISOString(),
          status: "pending"
        })
        .select()
        .single();

      if (revertError) throw revertError;

      // Create target for the group
      const { error: targetError } = await supabase
        .from("group_action_targets")
        .insert({
          action_id: revertAction.id,
          group_id: snapshot.group_id,
          status: "pending"
        });

      if (targetError) throw targetError;

      toast.success("Ação de reversão criada com sucesso");
      navigate("/dashboard/group-actions");
    } catch (error) {
      console.error("Error reverting:", error);
      toast.error("Erro ao criar ação de reversão");
    } finally {
      setReverting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "executing":
        return <Badge variant="default" className="bg-blue-500"><PlayCircle className="h-3 w-3 mr-1" />Executando</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case "cancelled":
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getActionTypeIcon = (type: string) => {
    switch (type) {
      case "name":
        return <Type className="h-5 w-5" />;
      case "description":
        return <FileText className="h-5 w-5" />;
      case "photo":
        return <Image className="h-5 w-5" />;
      default:
        return <Settings2 className="h-5 w-5" />;
    }
  };

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case "name":
        return "Nome";
      case "description":
        return "Descrição";
      case "photo":
        return "Foto";
      default:
        return type;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !action) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/group-actions")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Detalhes da Ação</h1>
            <p className="text-muted-foreground">
              Alterar {getActionTypeLabel(action.action_type)}
            </p>
          </div>
        </div>

        {/* Action Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-muted rounded-lg">
                {getActionTypeIcon(action.action_type)}
              </div>
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  Alterar {getActionTypeLabel(action.action_type)}
                  {getStatusBadge(action.status)}
                </CardTitle>
                <CardDescription>
                  {action.whatsapp_instances?.name} • {targets.length} grupo{targets.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {action.action_type !== "photo" && action.new_value_text && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Novo valor:</p>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="whitespace-pre-wrap">{action.new_value_text}</p>
                </div>
              </div>
            )}

            {action.action_type === "photo" && action.new_value_file_url && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Nova foto:</p>
                <img
                  src={action.new_value_file_url}
                  alt="Nova foto"
                  className="w-32 h-32 object-cover rounded-lg"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Criado em:</span>
                <span>{format(new Date(action.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Agendado para:</span>
                <span>{format(new Date(action.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
              {action.executed_at && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Executado em:</span>
                  <span>{format(new Date(action.executed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                </div>
              )}
            </div>

            {action.error_message && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                <strong>Erro:</strong> {action.error_message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Targets Table */}
        <Card>
          <CardHeader>
            <CardTitle>Grupos Afetados</CardTitle>
            <CardDescription>Status de execução por grupo</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Executado em</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((target) => (
                  <TableRow key={target.id}>
                    <TableCell className="font-medium">
                      {target.groups?.name || "Grupo removido"}
                    </TableCell>
                    <TableCell>{getStatusBadge(target.status)}</TableCell>
                    <TableCell>
                      {target.executed_at
                        ? format(new Date(target.executed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-destructive">
                      {target.error_message || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Snapshots / History */}
        {snapshots.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Alterações</CardTitle>
              <CardDescription>
                Estados anteriores dos grupos antes desta ação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{snapshot.groups?.name || "Grupo"}</p>
                        <p className="text-sm text-muted-foreground">
                          Snapshot de {format(new Date(snapshot.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevert(snapshot)}
                        disabled={reverting === snapshot.id}
                      >
                        {reverting === snapshot.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Reverter
                      </Button>
                    </div>

                    <div className="grid gap-2 text-sm">
                      {action.action_type === "name" && snapshot.name_before && (
                        <div className="bg-muted p-3 rounded">
                          <span className="text-muted-foreground">Nome anterior:</span>
                          <p className="font-medium">{snapshot.name_before}</p>
                        </div>
                      )}
                      {action.action_type === "description" && snapshot.description_before && (
                        <div className="bg-muted p-3 rounded">
                          <span className="text-muted-foreground">Descrição anterior:</span>
                          <p className="font-medium whitespace-pre-wrap">{snapshot.description_before}</p>
                        </div>
                      )}
                      {action.action_type === "photo" && snapshot.photo_url_before && (
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">Foto anterior:</span>
                          <img
                            src={snapshot.photo_url_before}
                            alt="Foto anterior"
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
