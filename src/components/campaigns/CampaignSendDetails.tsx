import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  MessageSquare,
  Image,
  BarChart2,
  AlertCircle,
  AlertTriangle,
  Users,
  Calendar,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SendLog {
  id: string;
  status: "pending" | "sent" | "failed";
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  scheduled_at: string | null;
  api_call_started_at: string | null;
  group_id: string;
  groups: { 
    id: string;
    name: string; 
    member_count: number;
  } | null;
  campaign_items: { 
    id: string;
    item_type: "text" | "media" | "poll"; 
    order_index: number;
    text_content: string | null;
  } | null;
}

interface CampaignSendDetailsProps {
  campaignId: string;
  campaignStatus: "draft" | "scheduled" | "running" | "completed" | "cancelled" | "deleted";
  expectedGroupsCount?: number;
  onRetrySuccess?: () => void;
}

// Helper function to translate error codes to user-friendly messages
const translateErrorMessage = (errorMessage: string | null): { title: string; description: string } => {
  if (!errorMessage) {
    return {
      title: "Erro desconhecido",
      description: "Não foi possível determinar a causa do erro. Tente novamente ou entre em contato com o suporte.",
    };
  }

  const lowerError = errorMessage.toLowerCase();

  // HTTP Status Codes
  if (lowerError.includes("http 400") || lowerError.includes("bad request")) {
    return {
      title: "Erro na requisição",
      description: "A mensagem contém dados inválidos. Verifique se o conteúdo está correto, sem caracteres especiais problemáticos ou mídia corrompida.",
    };
  }

  if (lowerError.includes("http 401") || lowerError.includes("unauthorized")) {
    return {
      title: "Não autorizado",
      description: "A instância do WhatsApp perdeu a conexão. Reconecte a instância escaneando o QR Code novamente.",
    };
  }

  if (lowerError.includes("http 403") || lowerError.includes("forbidden")) {
    return {
      title: "Acesso negado",
      description: "Você não tem permissão para enviar mensagens neste grupo. Verifique se a instância ainda é membro do grupo.",
    };
  }

  if (lowerError.includes("http 404") || lowerError.includes("not found")) {
    return {
      title: "Grupo não encontrado",
      description: "O grupo não existe mais ou a instância foi removida dele. Sincronize seus grupos para atualizar a lista.",
    };
  }

  if (lowerError.includes("http 429") || lowerError.includes("too many requests") || lowerError.includes("rate limit")) {
    return {
      title: "Muitas mensagens",
      description: "O WhatsApp limitou os envios temporariamente por excesso de mensagens. Aguarde alguns minutos e tente com menos grupos por vez.",
    };
  }

  if (lowerError.includes("http 500") || lowerError.includes("internal server error")) {
    return {
      title: "Erro no servidor",
      description: "O servidor de envio está temporariamente indisponível. Tente novamente em alguns minutos.",
    };
  }

  if (lowerError.includes("http 502") || lowerError.includes("bad gateway")) {
    return {
      title: "Servidor sobrecarregado",
      description: "O serviço está processando muitas solicitações. Aguarde alguns segundos e tente novamente.",
    };
  }

  if (lowerError.includes("http 503") || lowerError.includes("service unavailable")) {
    return {
      title: "Serviço indisponível",
      description: "O serviço de envio está em manutenção. Tente novamente em alguns minutos.",
    };
  }

  // Connection Errors
  if (lowerError.includes("timeout") || lowerError.includes("timed out")) {
    return {
      title: "Tempo esgotado",
      description: "A conexão com o servidor demorou muito. Verifique sua internet e tente novamente.",
    };
  }

  if (lowerError.includes("network") || lowerError.includes("connection refused")) {
    return {
      title: "Erro de conexão",
      description: "Não foi possível conectar ao servidor de envio. Verifique sua conexão com a internet.",
    };
  }

  // WhatsApp Specific Errors
  if (lowerError.includes("not in group") || lowerError.includes("not a participant")) {
    return {
      title: "Não é membro do grupo",
      description: "A instância do WhatsApp não faz mais parte deste grupo. Adicione-a novamente ao grupo ou remova-o da campanha.",
    };
  }

  if (lowerError.includes("media") && (lowerError.includes("invalid") || lowerError.includes("corrupt"))) {
    return {
      title: "Mídia inválida",
      description: "O arquivo de mídia está corrompido ou em formato não suportado. Use imagens JPG/PNG ou vídeos MP4.",
    };
  }

  if (lowerError.includes("media") && lowerError.includes("too large")) {
    return {
      title: "Arquivo muito grande",
      description: "O arquivo de mídia excede o tamanho máximo permitido. Reduza o tamanho do arquivo e tente novamente.",
    };
  }

  if (lowerError.includes("blocked") || lowerError.includes("banned")) {
    return {
      title: "Conta bloqueada",
      description: "Esta conta do WhatsApp foi bloqueada ou banida. Use outra instância para continuar os envios.",
    };
  }

  if (lowerError.includes("disconnected") || lowerError.includes("desconectado")) {
    return {
      title: "WhatsApp desconectado",
      description: "A instância do WhatsApp perdeu a conexão durante o envio. Reconecte a instância e tente novamente.",
    };
  }

  if (lowerError.includes("instancia") && lowerError.includes("não selecionada")) {
    return {
      title: "Instância não configurada",
      description: "O grupo pertence a uma instância que não foi selecionada para esta campanha. Edite a campanha e adicione a instância correta.",
    };
  }

  // Timeout/expiration errors
  if (lowerError.includes("timeout") && lowerError.includes("servidor")) {
    return {
      title: "Tempo de envio excedido",
      description: "A campanha demorou muito para ser processada e foi encerrada automaticamente. Os grupos não processados foram marcados como falha. Use o botão 'Reenviar Falhas' para tentar novamente.",
    };
  }

  if (lowerError.includes("expirou") || lowerError.includes("expired")) {
    return {
      title: "Campanha expirada",
      description: "A campanha passou do tempo limite de envio. Crie uma nova campanha se ainda deseja enviar as mensagens.",
    };
  }

  // Poll specific errors
  if (lowerError.includes("poll") || lowerError.includes("enquete")) {
    return {
      title: "Erro na enquete",
      description: "Não foi possível criar a enquete. Verifique se o texto e as opções estão preenchidos corretamente.",
    };
  }

  // Generic fallback
  return {
    title: "Falha no envio",
    description: errorMessage,
  };
};

const getItemTypeIcon = (type: string) => {
  switch (type) {
    case "text":
      return <MessageSquare className="h-4 w-4" />;
    case "media":
      return <Image className="h-4 w-4" />;
    case "poll":
      return <BarChart2 className="h-4 w-4" />;
    default:
      return <MessageSquare className="h-4 w-4" />;
  }
};

const getItemTypeName = (type: string) => {
  const map: Record<string, string> = {
    text: "Texto",
    media: "Mídia",
    poll: "Enquete",
  };
  return map[type] || type;
};

export function CampaignSendDetails({ 
  campaignId, 
  campaignStatus,
  expectedGroupsCount,
  onRetrySuccess,
}: CampaignSendDetailsProps) {
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryingGroup, setRetryingGroup] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "sent" | "failed" | "pending">("all");

  useEffect(() => {
    fetchLogs();
  }, [campaignId]);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("send_logs")
        .select(`
          id,
          status,
          error_message,
          sent_at,
          created_at,
          scheduled_at,
          api_call_started_at,
          group_id,
          groups (id, name, member_count),
          campaign_items (id, item_type, order_index, text_content)
        `)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique groups from logs
  const groupsWithLogs = new Set(logs.map(l => l.group_id));

  // Get groups with failures
  const groupsWithFailures = logs
    .filter(l => l.status === "failed")
    .reduce((acc, log) => {
      if (!acc.has(log.group_id)) {
        acc.set(log.group_id, {
          group: log.groups,
          failedCount: 0,
          logs: [],
        });
      }
      const entry = acc.get(log.group_id)!;
      entry.failedCount++;
      entry.logs.push(log);
      return acc;
    }, new Map<string, { group: SendLog["groups"]; failedCount: number; logs: SendLog[] }>());

  const handleRetryAll = async () => {
    if (!confirm("Deseja reenviar todas as mensagens que falharam?")) return;
    
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("retry-campaign-failed", {
        body: { campaignId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data?.message || "Retentativa iniciada!");
      await fetchLogs();
      onRetrySuccess?.();
    } catch (error: any) {
      console.error("Error retrying:", error);
      toast.error(error.message || "Erro ao reenviar mensagens");
    } finally {
      setRetrying(false);
    }
  };

  const handleRetryGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Deseja reenviar as mensagens que falharam para "${groupName}"?`)) return;
    
    setRetryingGroup(groupId);
    try {
      const { data, error } = await supabase.functions.invoke("retry-campaign-failed", {
        body: { campaignId, groupId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data?.message || "Retentativa iniciada!");
      await fetchLogs();
      onRetrySuccess?.();
    } catch (error: any) {
      console.error("Error retrying group:", error);
      toast.error(error.message || "Erro ao reenviar mensagens");
    } finally {
      setRetryingGroup(null);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    return log.status === filter;
  });

  // Group logs by group for better visualization
  const logsByGroup = filteredLogs.reduce((acc, log) => {
    const groupId = log.group_id;
    if (!acc[groupId]) {
      acc[groupId] = {
        group: log.groups,
        logs: [],
      };
    }
    acc[groupId].logs.push(log);
    return acc;
  }, {} as Record<string, { group: SendLog["groups"]; logs: SendLog[] }>);

  const stats = {
    total: logs.length,
    sent: logs.filter((l) => l.status === "sent").length,
    failed: logs.filter((l) => l.status === "failed").length,
    pending: logs.filter((l) => l.status === "pending").length,
  };

  const progressPercentage = stats.total > 0 ? ((stats.sent + stats.failed) / stats.total) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nenhum envio registrado</h3>
          <p className="text-muted-foreground text-center">
            {campaignStatus === "scheduled" 
              ? "A campanha será enviada na data agendada" 
              : "Inicie a campanha para ver os detalhes de envio"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total de envios</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-success">{stats.sent}</p>
              <p className="text-sm text-muted-foreground">Enviados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-destructive">{stats.failed}</p>
              <p className="text-sm text-muted-foreground">Falhas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-warning">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {campaignStatus === "running" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Campanha em andamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.sent + stats.failed} de {stats.total} processados ({Math.round(progressPercentage)}%)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Failures Alert */}
      {stats.failed > 0 && (campaignStatus === "completed" || campaignStatus === "running") && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            <span>Falhas detectadas</span>
            <Button 
              size="sm" 
              variant="destructive"
              onClick={handleRetryAll}
              disabled={retrying}
              className="gap-2"
            >
              {retrying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Reenviar Falhas ({stats.failed})
            </Button>
          </AlertTitle>
          <AlertDescription className="mt-2">
            <div className="space-y-2">
              <p>
                {stats.failed} mensagem(s) falharam ao enviar. Grupos com problemas:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {Array.from(groupsWithFailures.entries()).map(([groupId, { group, failedCount }]) => (
                  <Badge 
                    key={groupId} 
                    variant="outline" 
                    className="bg-background border-destructive/30 gap-1 cursor-pointer hover:bg-destructive/20 transition-colors"
                    onClick={() => group && handleRetryGroup(groupId, group.name)}
                  >
                    <XCircle className="h-3 w-3 text-destructive" />
                    {group?.name || "Desconhecido"}
                    <span className="text-destructive">({failedCount})</span>
                    {retryingGroup === groupId ? (
                      <Loader2 className="h-3 w-3 animate-spin ml-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 ml-1 opacity-50" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Logs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Detalhes dos Envios</CardTitle>
              <CardDescription>
                Histórico completo de cada mensagem enviada
              </CardDescription>
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList>
                <TabsTrigger value="all" className="gap-1">
                  Todos
                  <Badge variant="secondary" className="h-5 px-1.5">{stats.total}</Badge>
                </TabsTrigger>
                <TabsTrigger value="sent" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Enviados
                  <Badge variant="secondary" className="h-5 px-1.5">{stats.sent}</Badge>
                </TabsTrigger>
                <TabsTrigger value="failed" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Falhas
                  <Badge variant="secondary" className="h-5 px-1.5">{stats.failed}</Badge>
                </TabsTrigger>
                {stats.pending > 0 && (
                  <TabsTrigger value="pending" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Pendentes
                    <Badge variant="secondary" className="h-5 px-1.5">{stats.pending}</Badge>
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.keys(logsByGroup).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum registro encontrado com o filtro selecionado
              </div>
            ) : (
              <Accordion 
                type="multiple" 
                className="space-y-2"
                onValueChange={(values) => {
                  // Scroll to the last opened accordion item
                  if (values.length > 0) {
                    const lastValue = values[values.length - 1];
                    setTimeout(() => {
                      const element = document.querySelector(`[data-accordion-id="${lastValue}"]`);
                      if (element) {
                        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }
                    }, 100);
                  }
                }}
              >
                {Object.entries(logsByGroup).map(([groupId, { group, logs: groupLogs }]) => {
                  const groupSent = groupLogs.filter((l) => l.status === "sent").length;
                  const groupFailed = groupLogs.filter((l) => l.status === "failed").length;
                  const groupPending = groupLogs.filter((l) => l.status === "pending").length;

                  return (
                    <AccordionItem
                      key={groupId}
                      value={groupId}
                      className="border rounded-lg px-4"
                      data-accordion-id={groupId}
                    >
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-3 flex-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{group?.name || "Grupo desconhecido"}</span>
                          <span className="text-xs text-muted-foreground">
                            ({group?.member_count || 0} membros)
                          </span>
                          <div className="flex items-center gap-2 ml-auto mr-4">
                            {groupSent > 0 && (
                              <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {groupSent}
                              </Badge>
                            )}
                            {groupFailed > 0 && (
                              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 gap-1">
                                <XCircle className="h-3 w-3" />
                                {groupFailed}
                              </Badge>
                            )}
                            {groupPending > 0 && (
                              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 gap-1">
                                <Clock className="h-3 w-3" />
                                {groupPending}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {/* Group Retry Button */}
                        {groupFailed > 0 && (
                          <div className="py-2 mb-3 border-b">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRetryGroup(groupId, group?.name || "Grupo");
                              }}
                              disabled={retryingGroup === groupId}
                              className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                            >
                              {retryingGroup === groupId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                              Reenviar {groupFailed} mensagem(s) falhada(s)
                            </Button>
                          </div>
                        )}
                        <div className="space-y-3 py-2">
                          {groupLogs.map((log) => {
                            const errorInfo = translateErrorMessage(log.error_message);
                            
                            return (
                              <div
                                key={log.id}
                                className={cn(
                                  "p-3 rounded-lg border",
                                  log.status === "sent" && "bg-success/5 border-success/20",
                                  log.status === "failed" && "bg-destructive/5 border-destructive/20",
                                  log.status === "pending" && "bg-warning/5 border-warning/20"
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <div className={cn(
                                      "p-2 rounded-full",
                                      log.status === "sent" && "bg-success/20 text-success",
                                      log.status === "failed" && "bg-destructive/20 text-destructive",
                                      log.status === "pending" && "bg-warning/20 text-warning"
                                    )}>
                                      {log.status === "sent" && <CheckCircle2 className="h-4 w-4" />}
                                      {log.status === "failed" && <XCircle className="h-4 w-4" />}
                                      {log.status === "pending" && <Clock className="h-4 w-4" />}
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        {log.campaign_items && (
                                          <Badge variant="outline" className="gap-1">
                                            {getItemTypeIcon(log.campaign_items.item_type)}
                                            {getItemTypeName(log.campaign_items.item_type)} #{log.campaign_items.order_index + 1}
                                          </Badge>
                                        )}
                                        <Badge
                                          variant={
                                            log.status === "sent"
                                              ? "default"
                                              : log.status === "failed"
                                              ? "destructive"
                                              : "secondary"
                                          }
                                          className={cn(
                                            log.status === "sent" && "bg-success"
                                          )}
                                        >
                                          {log.status === "sent" && "Enviado"}
                                          {log.status === "failed" && "Falhou"}
                                          {log.status === "pending" && "Pendente"}
                                        </Badge>
                                      </div>
                                      
                                      {log.status === "failed" && (
                                        <div className="mt-2 p-3 rounded bg-destructive/10">
                                          <div className="flex items-start gap-2">
                                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                            <div>
                                              <p className="font-medium text-destructive text-sm">
                                                {errorInfo.title}
                                              </p>
                                              <p className="text-sm text-muted-foreground mt-1">
                                                {errorInfo.description}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="text-right text-xs text-muted-foreground">
                                    {log.sent_at ? (
                                      <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(log.sent_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                      </div>
                                    ) : log.scheduled_at ? (
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Agendado: {format(new Date(log.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Criado: {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
