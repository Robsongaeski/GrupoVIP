import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Megaphone,
  Plus,
  Play,
  Trash2,
  Loader2,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Edit,
  Users,
  MessageSquare,
  AlertCircle,
  Eye,
  Ban,
  Copy,
  Calendar,
  Smartphone,
} from "lucide-react";

interface CampaignInstance {
  instance_id: string;
  whatsapp_instances: {
    id: string;
    name: string;
    nickname: string | null;
  } | null;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  message_content: string;
  status: "draft" | "scheduled" | "running" | "completed" | "cancelled" | "deleted";
  scheduled_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  deleted_at?: string | null;
  items_count?: number;
  groups_count?: number;
  instances?: CampaignInstance[];
}

interface SendLog {
  id: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  groups: { name: string } | null;
  campaign_items: { item_type: string; order_index: number } | null;
}

type StatusFilter = "all" | "draft" | "scheduled" | "running" | "completed" | "cancelled";

export default function Campaigns() {
  const { user, loading: authLoading } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [errorsDialogOpen, setErrorsDialogOpen] = useState(false);
  const [selectedCampaignErrors, setSelectedCampaignErrors] = useState<SendLog[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [user, effectiveUserId]);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select(`
          *,
          campaign_items(count),
          campaign_groups(count),
          campaign_instances(
            instance_id,
            whatsapp_instances(id, name, nickname)
          )
        `)
        .eq("user_id", effectiveUserId)
        .neq("status", "deleted")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const campaignsWithCounts = (data || []).map((c) => ({
        ...c,
        items_count: c.campaign_items?.[0]?.count || 0,
        groups_count: c.campaign_groups?.[0]?.count || 0,
        instances: c.campaign_instances || [],
      }));

      setCampaigns(campaignsWithCounts);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  const handleViewErrors = async (campaignId: string) => {
    setLoadingErrors(true);
    setErrorsDialogOpen(true);
    try {
      const { data, error } = await supabase
        .from("send_logs")
        .select(`
          id,
          status,
          error_message,
          sent_at,
          created_at,
          groups (name),
          campaign_items (item_type, order_index)
        `)
        .eq("campaign_id", campaignId)
        .eq("status", "failed")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setSelectedCampaignErrors(data || []);
    } catch (error) {
      console.error("Error fetching errors:", error);
      toast.error("Erro ao carregar erros");
    } finally {
      setLoadingErrors(false);
    }
  };

  const handleStartCampaign = async (campaign: Campaign) => {
    if (campaign.groups_count === 0) {
      toast.error("Selecione pelo menos um grupo para a campanha");
      navigate(`/dashboard/campaigns/${campaign.id}`);
      return;
    }

    if (campaign.items_count === 0) {
      toast.error("Adicione pelo menos uma mensagem à campanha");
      navigate(`/dashboard/campaigns/${campaign.id}`);
      return;
    }

    if (!confirm("Tem certeza que deseja iniciar esta campanha? As mensagens serão enviadas imediatamente.")) {
      return;
    }

    setSending(campaign.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-campaign", {
        body: { campaignId: campaign.id },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(data?.message || "Campanha iniciada!");
      fetchCampaigns();
    } catch (error: any) {
      console.error("Error starting campaign:", error);
      toast.error(error.message || "Erro ao iniciar campanha");
    } finally {
      setSending(null);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta campanha?")) return;

    try {
      // Soft delete - marca como deleted em vez de remover
      const { error } = await supabase
        .from("campaigns")
        .update({ 
          status: "deleted" as const,
          deleted_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Campanha excluída com sucesso!");
      fetchCampaigns();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast.error("Erro ao excluir campanha");
    }
  };

  const handleCancelCampaign = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta campanha?")) return;

    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;

      toast.success("Campanha cancelada com sucesso!");
      fetchCampaigns();
    } catch (error) {
      console.error("Error cancelling campaign:", error);
      toast.error("Erro ao cancelar campanha");
    }
  };

  const handleDuplicateCampaign = async (campaignId: string) => {
    try {
      // Get original campaign
      const { data: original, error: fetchError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (fetchError || !original) throw fetchError;

      // Create duplicated campaign
      const { data: newCampaign, error: createError } = await supabase
        .from("campaigns")
        .insert({
          user_id: user!.id,
          name: `${original.name} (Cópia)`,
          description: original.description,
          message_content: original.message_content,
          delay_between_items: original.delay_between_items,
          delay_between_groups: original.delay_between_groups,
          whatsapp_instance_id: original.whatsapp_instance_id,
          status: "draft",
        })
        .select()
        .single();

      if (createError || !newCampaign) throw createError;

      // Duplicate campaign items
      const { data: items } = await supabase
        .from("campaign_items")
        .select("*")
        .eq("campaign_id", campaignId);

      if (items && items.length > 0) {
        const duplicatedItems = items.map(({ id, campaign_id, created_at, updated_at, ...item }) => ({
          ...item,
          campaign_id: newCampaign.id,
        }));

        await supabase.from("campaign_items").insert(duplicatedItems);
      }

      // Duplicate campaign groups
      const { data: groups } = await supabase
        .from("campaign_groups")
        .select("group_id")
        .eq("campaign_id", campaignId);

      if (groups && groups.length > 0) {
        const duplicatedGroups = groups.map((g) => ({
          campaign_id: newCampaign.id,
          group_id: g.group_id,
        }));

        await supabase.from("campaign_groups").insert(duplicatedGroups);
      }

      // Duplicate campaign instances
      const { data: campaignInstances } = await supabase
        .from("campaign_instances")
        .select("instance_id")
        .eq("campaign_id", campaignId);

      if (campaignInstances && campaignInstances.length > 0) {
        const duplicatedInstances = campaignInstances.map((ci) => ({
          campaign_id: newCampaign.id,
          instance_id: ci.instance_id,
        }));

        await supabase.from("campaign_instances").insert(duplicatedInstances);
      }

      toast.success("Campanha duplicada com sucesso!");
      navigate(`/dashboard/campaigns/${newCampaign.id}`);
    } catch (error) {
      console.error("Error duplicating campaign:", error);
      toast.error("Erro ao duplicar campanha");
    }
  };

  const getStatusBadge = (status: Campaign["status"]) => {
    const config = {
      draft: { label: "Rascunho", variant: "secondary" as const, icon: Clock },
      scheduled: { label: "Agendada", variant: "outline" as const, icon: Clock },
      running: { label: "Enviando", variant: "default" as const, icon: Send },
      completed: { label: "Concluída", variant: "default" as const, icon: CheckCircle2 },
      cancelled: { label: "Cancelada", variant: "destructive" as const, icon: XCircle },
    };
    const cfg = config[status];
    return (
      <Badge variant={cfg.variant} className={`gap-1 ${status === "completed" ? "bg-success" : ""}`}>
        <cfg.icon className={`h-3 w-3 ${status === "running" ? "animate-pulse" : ""}`} />
        {cfg.label}
      </Badge>
    );
  };

  const getItemTypeName = (type: string) => {
    const map: Record<string, string> = {
      text: "Texto",
      media: "Mídia",
      poll: "Enquete",
    };
    return map[type] || type;
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    if (statusFilter === "all") return true;
    return campaign.status === statusFilter;
  });

  const statusFilterOptions: { value: StatusFilter; label: string; count: number }[] = [
    { value: "all", label: "Todas", count: campaigns.length },
    { value: "draft", label: "Rascunho", count: campaigns.filter(c => c.status === "draft").length },
    { value: "scheduled", label: "Agendadas", count: campaigns.filter(c => c.status === "scheduled").length },
    { value: "running", label: "Enviando", count: campaigns.filter(c => c.status === "running").length },
    { value: "completed", label: "Concluídas", count: campaigns.filter(c => c.status === "completed").length },
    { value: "cancelled", label: "Canceladas", count: campaigns.filter(c => c.status === "cancelled").length },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Campanhas</h1>
            <p className="text-muted-foreground">
              Crie sequências de mensagens para seus grupos
            </p>
          </div>
          <Button onClick={() => navigate("/dashboard/campaigns/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Campanha
          </Button>
        </div>

        {/* Status Filter */}
        {!loading && campaigns.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {statusFilterOptions.map((option) => (
              <Button
                key={option.value}
                variant={statusFilter === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(option.value)}
                className="gap-2"
              >
                {option.label}
                <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                  {option.count}
                </Badge>
              </Button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Megaphone className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma campanha</h3>
              <p className="text-muted-foreground text-center mb-4">
                Crie sua primeira campanha com sequência de mensagens
              </p>
              <Button onClick={() => navigate("/dashboard/campaigns/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Campanha
              </Button>
            </CardContent>
          </Card>
        ) : filteredCampaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Megaphone className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma campanha encontrada</h3>
              <p className="text-muted-foreground text-center mb-4">
                Não há campanhas com o status selecionado
              </p>
              <Button variant="outline" onClick={() => setStatusFilter("all")}>
                Ver todas as campanhas
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCampaigns.map((campaign) => (
              <Card key={campaign.id} className="hover:shadow-lg transition-shadow group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg truncate">{campaign.name}</CardTitle>
                      {campaign.description && (
                        <CardDescription className="truncate">
                          {campaign.description}
                        </CardDescription>
                      )}
                    </div>
                    {getStatusBadge(campaign.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      <span>{campaign.items_count || 0} msgs</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{campaign.groups_count || 0} grupos</span>
                    </div>
                  </div>

                  {/* Scheduled info */}
                  {campaign.status === "scheduled" && campaign.scheduled_at && (
                    <div className="p-3 rounded-lg bg-muted/50 space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span>
                          <strong>Agendada para:</strong>{" "}
                          {format(new Date(campaign.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {campaign.instances && campaign.instances.length > 0 && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <Smartphone className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>{campaign.instances.length > 1 ? "Instâncias:" : "Instância:"}</strong>{" "}
                            {campaign.instances
                              .map((ci) => ci.whatsapp_instances?.nickname || ci.whatsapp_instances?.name || "Desconhecida")
                              .join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Progress for running/completed */}
                  {(campaign.status === "running" || campaign.status === "completed") && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-muted/30">
                        <p className="text-lg font-bold">{campaign.total_recipients}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="p-2 rounded-lg bg-success/10">
                        <p className="text-lg font-bold text-success">{campaign.sent_count}</p>
                        <p className="text-xs text-muted-foreground">Enviados</p>
                      </div>
                      <div 
                        className={`p-2 rounded-lg bg-destructive/10 ${campaign.failed_count > 0 ? "cursor-pointer hover:bg-destructive/20 transition-colors" : ""}`}
                        onClick={() => campaign.failed_count > 0 && handleViewErrors(campaign.id)}
                      >
                        <p className="text-lg font-bold text-destructive flex items-center justify-center gap-1">
                          {campaign.failed_count}
                          {campaign.failed_count > 0 && <Eye className="h-3 w-3" />}
                        </p>
                        <p className="text-xs text-muted-foreground">Falhas</p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    {campaign.status === "draft" && (
                      <>
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleStartCampaign(campaign)}
                          disabled={sending === campaign.id}
                        >
                          {sending === campaign.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="mr-2 h-4 w-4" />
                          )}
                          Iniciar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/dashboard/campaigns/${campaign.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicateCampaign(campaign.id)}
                          title="Duplicar campanha"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {campaign.status === "scheduled" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate(`/dashboard/campaigns/${campaign.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-warning hover:text-warning"
                          onClick={() => handleCancelCampaign(campaign.id)}
                          title="Cancelar agendamento"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicateCampaign(campaign.id)}
                          title="Duplicar campanha"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          title="Excluir campanha"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {(campaign.status === "running" || campaign.status === "completed") && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate(`/dashboard/campaigns/${campaign.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicateCampaign(campaign.id)}
                          title="Duplicar campanha"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          title="Excluir campanha"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {campaign.status === "cancelled" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate(`/dashboard/campaigns/${campaign.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicateCampaign(campaign.id)}
                          title="Duplicar campanha"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          title="Excluir campanha"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Errors Dialog */}
        <Dialog open={errorsDialogOpen} onOpenChange={setErrorsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Erros de Envio
              </DialogTitle>
              <DialogDescription>
                Detalhes das falhas durante o envio da campanha
              </DialogDescription>
            </DialogHeader>
            {loadingErrors ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : selectedCampaignErrors.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum erro encontrado
              </p>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {selectedCampaignErrors.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg border border-destructive/20 bg-destructive/5"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {log.groups?.name || "Grupo desconhecido"}
                        </span>
                        {log.campaign_items && (
                          <Badge variant="outline" className="text-xs">
                            {getItemTypeName(log.campaign_items.item_type)} #{log.campaign_items.order_index + 1}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-destructive">
                        {log.error_message || "Erro desconhecido"}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
