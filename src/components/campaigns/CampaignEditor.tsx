import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormStepIndicator, Step } from "@/components/ui/form-step-indicator";
import { RequiredField } from "@/components/ui/required-field";
import { SectionStatus } from "@/components/ui/validation-summary";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Type,
  Image,
  BarChart2,
  Loader2,
  Users,
  Smartphone,
  CalendarIcon,
  Clock,
  Settings,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  XCircle,
  Send,
  Ban,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { CampaignItemEditor, CampaignItem } from "./CampaignItemEditor";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { CampaignSendDetails } from "./CampaignSendDetails";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  message_content: string;
  status: "draft" | "scheduled" | "running" | "completed" | "cancelled" | "deleted";
  delay_between_items: number;
  delay_between_groups: number;
  whatsapp_instance_id: string | null;
  scheduled_at: string | null;
  deleted_at?: string | null;
}

interface GroupInstance {
  instance_id: string;
  is_admin: boolean;
  whatsapp_instances: {
    id: string;
    name: string;
    nickname: string | null;
  };
}

interface Group {
  id: string;
  name: string;
  member_count: number;
  instance_id?: string | null;
  group_instances?: GroupInstance[];
}

interface WhatsAppInstance {
  id: string;
  name: string;
  nickname: string | null;
  status: string;
}

export default function CampaignEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const isNew = id === "new";

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [items, setItems] = useState<CampaignItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);
  const [instancesDialogOpen, setInstancesDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("config");

  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("12:00");

  // Validation state - tracks if user attempted to submit
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const DRAFT_KEY = "campaign_draft";

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    delay_between_items: 2,
    delay_between_groups: 3,
    whatsapp_instance_id: "",
  });

  // Restore draft from sessionStorage for new campaigns
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, id, effectiveUserId]);

  // Auto-save draft to sessionStorage
  useEffect(() => {
    if (!isNew || loading || !draftRestored) return;
    const draft = {
      formData,
      items,
      selectedGroups,
      selectedInstances,
      activeTab,
      isScheduled,
      scheduledDate: scheduledDate?.toISOString() || null,
      scheduledTime,
    };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [formData, items, selectedGroups, selectedInstances, activeTab, isScheduled, scheduledDate, scheduledTime, isNew, loading, draftRestored]);

  const fetchData = async () => {
    try {
      // Fetch groups and instances in parallel
      const [groupsRes, instancesRes] = await Promise.all([
        supabase
          .from("groups")
          .select(`
            id, name, member_count, instance_id,
            group_instances (
              instance_id,
              is_admin,
              whatsapp_instances (id, name, nickname)
            )
          `)
          .eq("user_id", effectiveUserId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("whatsapp_instances")
          .select("id, name, nickname, status")
          .eq("user_id", effectiveUserId)
          .eq("status", "connected")
          .order("name"),
      ]);

      setGroups(groupsRes.data || []);
      setInstances(instancesRes.data || []);

      if (!isNew && id) {
        // Fetch campaign
        const { data: campaignData, error: campaignError } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", id)
          .single();

        if (campaignError) throw campaignError;
        setCampaign(campaignData);
        setFormData({
          name: campaignData.name,
          description: campaignData.description || "",
          delay_between_items: campaignData.delay_between_items || 2,
          delay_between_groups: campaignData.delay_between_groups || 3,
          whatsapp_instance_id: campaignData.whatsapp_instance_id || "",
        });

        // Fetch selected instances for this campaign
        const { data: campaignInstances } = await supabase
          .from("campaign_instances")
          .select("instance_id")
          .eq("campaign_id", id);

        if (campaignInstances && campaignInstances.length > 0) {
          setSelectedInstances(campaignInstances.map((ci) => ci.instance_id));
        } else if (campaignData.whatsapp_instance_id) {
          // Fallback to legacy single instance
          setSelectedInstances([campaignData.whatsapp_instance_id]);
        }

        // Load scheduling data
        if (campaignData.scheduled_at) {
          setIsScheduled(true);
          const scheduledDateTime = new Date(campaignData.scheduled_at);
          setScheduledDate(scheduledDateTime);
          setScheduledTime(format(scheduledDateTime, "HH:mm"));
        }

        // Fetch campaign items
        const { data: itemsData } = await supabase
          .from("campaign_items")
          .select("*")
          .eq("campaign_id", id)
          .order("order_index");

        if (itemsData) {
          setItems(
            itemsData.map((item) => ({
              ...item,
              poll_options: (item.poll_options as string[]) || [],
            }))
          );
        }

        // Fetch selected groups
        const { data: campaignGroups } = await supabase
          .from("campaign_groups")
          .select("group_id")
          .eq("campaign_id", id);

        setSelectedGroups(campaignGroups?.map((cg) => cg.group_id) || []);
      } else {
        // New campaign - try to restore draft from sessionStorage
        const savedDraft = sessionStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
          try {
            const draft = JSON.parse(savedDraft);
            if (draft.formData) setFormData(draft.formData);
            if (draft.items && draft.items.length > 0) setItems(draft.items);
            else setItems([createNewItem("text", 0)]);
            if (draft.selectedGroups) setSelectedGroups(draft.selectedGroups);
            if (draft.selectedInstances) setSelectedInstances(draft.selectedInstances);
            if (draft.activeTab) setActiveTab(draft.activeTab);
            if (draft.isScheduled !== undefined) setIsScheduled(draft.isScheduled);
            if (draft.scheduledDate) setScheduledDate(new Date(draft.scheduledDate));
            if (draft.scheduledTime) setScheduledTime(draft.scheduledTime);
            setDraftRestored(true);
          } catch {
            // Invalid draft, use defaults
            setItems([createNewItem("text", 0)]);
            setDraftRestored(true);
          }
        } else {
          // No draft - use defaults
          setItems([createNewItem("text", 0)]);
          
          // Auto-select all connected instances if any
          if (instancesRes.data && instancesRes.data.length > 0) {
            setSelectedInstances(instancesRes.data.map((i) => i.id));
          }
          
          // Auto-select group if only one available
          if (groupsRes.data && groupsRes.data.length === 1) {
            setSelectedGroups([groupsRes.data[0].id]);
          }
          setDraftRestored(true);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const createNewItem = (
    type: "text" | "media" | "poll",
    orderIndex: number
  ): CampaignItem => ({
    id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    item_type: type,
    text_content: null,
    media_type: type === "media" ? "image" : null,
    media_url: null,
    media_filename: null,
    media_caption: null,
    poll_question: null,
    poll_options: type === "poll" ? ["", ""] : null,
    poll_allow_multiple: false,
    order_index: orderIndex,
    delay_after: 2,
  });

  const addItem = (type: "text" | "media" | "poll") => {
    const newItem = createNewItem(type, items.length);
    setItems([...items, newItem]);
  };

  const updateItem = (index: number, updatedItem: CampaignItem) => {
    const newItems = [...items];
    newItems[index] = updatedItem;
    setItems(newItems);
  };

  const deleteItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("A campanha precisa ter pelo menos uma mensagem");
      return;
    }
    const newItems = items.filter((_, i) => i !== index);
    // Reorder
    newItems.forEach((item, i) => {
      item.order_index = i;
    });
    setItems(newItems);
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === items.length - 1)
    ) {
      return;
    }

    const newItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    // Swap items
    [newItems[index], newItems[targetIndex]] = [
      newItems[targetIndex],
      newItems[index],
    ];

    // Update order_index
    newItems.forEach((item, i) => {
      item.order_index = i;
    });

    setItems(newItems);
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newItems = arrayMove(items, oldIndex, newIndex);
    newItems.forEach((item, i) => {
      item.order_index = i;
    });
    setItems(newItems);
  }, [items]);


  const validationErrors = {
    name: !formData.name.trim(),
    instances: selectedInstances.length === 0,
    groups: selectedGroups.length === 0,
  };

  const validateConfig = (): boolean => {
    setShowValidationErrors(true);
    
    if (validationErrors.name) {
      toast.error("Digite um nome para a campanha");
      return false;
    }

    if (validationErrors.instances) {
      toast.error("Selecione pelo menos uma instância WhatsApp");
      return false;
    }

    if (validationErrors.groups) {
      toast.error("Selecione pelo menos um grupo de destino");
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateConfig()) {
      setActiveTab("messages");
    }
  };

  const handleSave = async () => {
    setShowValidationErrors(true);
    
    if (validationErrors.name) {
      toast.error("Digite um nome para a campanha");
      setActiveTab("config");
      return;
    }

    if (validationErrors.instances) {
      toast.error("Selecione pelo menos uma instância WhatsApp");
      setActiveTab("config");
      return;
    }

    if (items.length === 0) {
      toast.error("Adicione pelo menos uma mensagem");
      return;
    }

    // Validate items
    for (const item of items) {
      if (item.item_type === "text" && !item.text_content?.trim()) {
        toast.error("Preencha o conteúdo de todas as mensagens de texto");
        return;
      }
      if (item.item_type === "poll") {
        if (!item.poll_question?.trim()) {
          toast.error("Preencha a pergunta da enquete");
          return;
        }
        const validOptions = (item.poll_options || []).filter((o) => o.trim());
        if (validOptions.length < 2) {
          toast.error("Adicione pelo menos 2 opções na enquete");
          return;
        }
      }
    }

    setSaving(true);
    try {
      let campaignId = id;

      // Build scheduled_at from date and time
      let scheduled_at: string | null = null;
      let status: "draft" | "scheduled" = "draft";
      
      if (isScheduled && scheduledDate) {
        const [hours, minutes] = scheduledTime.split(":").map(Number);
        const scheduledDateTime = new Date(scheduledDate);
        scheduledDateTime.setHours(hours, minutes, 0, 0);
        scheduled_at = scheduledDateTime.toISOString();
        status = "scheduled";
      }

      if (isNew) {
        // Create campaign
        const { data: newCampaign, error: createError } = await supabase
          .from("campaigns")
          .insert({
            user_id: effectiveUserId,
            name: formData.name,
            description: formData.description || null,
            message_content: items[0]?.text_content || "",
            delay_between_items: formData.delay_between_items,
            delay_between_groups: formData.delay_between_groups,
            whatsapp_instance_id: selectedInstances[0] || null, // Keep first instance for legacy compatibility
            scheduled_at,
            status,
          })
          .select()
          .single();

        if (createError) throw createError;
        campaignId = newCampaign.id;

        // Save campaign instances
        if (selectedInstances.length > 0) {
          const instancesToInsert = selectedInstances.map((instanceId) => ({
            campaign_id: campaignId,
            instance_id: instanceId,
          }));
          await supabase.from("campaign_instances").insert(instancesToInsert);
        }
      } else {
        // Update campaign
        const { error: updateError } = await supabase
          .from("campaigns")
          .update({
            name: formData.name,
            description: formData.description || null,
            message_content: items[0]?.text_content || "",
            delay_between_items: formData.delay_between_items,
            delay_between_groups: formData.delay_between_groups,
            whatsapp_instance_id: selectedInstances[0] || null, // Keep first instance for legacy compatibility
            scheduled_at,
            status: campaign?.status === "draft" ? status : campaign?.status,
          })
          .eq("id", id);

        if (updateError) throw updateError;

        // Update campaign instances
        await supabase.from("campaign_instances").delete().eq("campaign_id", id);
        if (selectedInstances.length > 0) {
          const instancesToInsert = selectedInstances.map((instanceId) => ({
            campaign_id: id,
            instance_id: instanceId,
          }));
          await supabase.from("campaign_instances").insert(instancesToInsert);
        }

        // Delete existing items
        await supabase.from("campaign_items").delete().eq("campaign_id", id);
      }

      // Insert items
      const itemsToInsert = items.map((item, index) => ({
        campaign_id: campaignId,
        item_type: item.item_type,
        text_content: item.text_content,
        media_type: item.media_type,
        media_url: item.media_url,
        media_filename: item.media_filename,
        media_caption: item.media_caption,
        poll_question: item.poll_question,
        poll_options: item.poll_options,
        poll_allow_multiple: item.poll_allow_multiple,
        order_index: index,
        delay_after: item.delay_after,
      }));

      const { error: itemsError } = await supabase
        .from("campaign_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Save campaign groups
      await supabase.from("campaign_groups").delete().eq("campaign_id", campaignId);

      if (selectedGroups.length > 0) {
        const groupsToInsert = selectedGroups.map((groupId) => ({
          campaign_id: campaignId,
          group_id: groupId,
        }));

        await supabase.from("campaign_groups").insert(groupsToInsert);
      }

      // Clear draft on successful save
      sessionStorage.removeItem(DRAFT_KEY);
      toast.success(isNew ? "Campanha criada com sucesso!" : "Campanha salva com sucesso!");
      navigate("/dashboard/campaigns");
    } catch (error) {
      console.error("Error saving campaign:", error);
      toast.error("Erro ao salvar campanha");
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleInstance = (instanceId: string) => {
    setSelectedInstances((prev) =>
      prev.includes(instanceId)
        ? prev.filter((id) => id !== instanceId)
        : [...prev, instanceId]
    );
  };

  // Calculate which groups are reachable by selected instances
  const getGroupAnalysis = () => {
    const selectedGroupDetails = groups.filter(g => selectedGroups.includes(g.id));
    
    const reachableGroups: Group[] = [];
    const unreachableGroups: Group[] = [];
    
    for (const group of selectedGroupDetails) {
      const groupInstanceIds = [
        ...(group.group_instances?.map(gi => gi.instance_id) || []),
        ...(group.instance_id ? [group.instance_id] : [])
      ];
      const hasSelectedInstance = selectedInstances.some(instId => groupInstanceIds.includes(instId));
      
      if (hasSelectedInstance) {
        reachableGroups.push(group);
      } else {
        unreachableGroups.push(group);
      }
    }
    
    // Calculate instance distribution
    const instanceDistribution: Record<string, { name: string; count: number }> = {};
    for (const group of reachableGroups) {
      const groupInstanceIds = group.group_instances?.map(gi => gi.instance_id) || [];
      const availableInstances = selectedInstances.filter(id => groupInstanceIds.includes(id));
      for (const instId of availableInstances) {
        if (!instanceDistribution[instId]) {
          const inst = instances.find(i => i.id === instId);
          instanceDistribution[instId] = { name: inst?.nickname || inst?.name || "Instância", count: 0 };
        }
        instanceDistribution[instId].count++;
      }
    }
    
    return { reachableGroups, unreachableGroups, instanceDistribution };
  };

  const groupAnalysis = getGroupAnalysis();

  const isConfigComplete = formData.name.trim() && selectedInstances.length > 0 && selectedGroups.length > 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Wizard steps for progress indicator
  const campaignSteps: Step[] = [
    {
      id: "config",
      label: "Configurações",
      icon: <Settings className="h-4 w-4" />,
      isComplete: isConfigComplete,
    },
    {
      id: "messages",
      label: "Mensagens",
      icon: <MessageSquare className="h-4 w-4" />,
      isComplete: items.length > 0 && items.every(item => 
        item.item_type === "text" ? !!item.text_content?.trim() : 
        item.item_type === "poll" ? !!item.poll_question?.trim() : true
      ),
    },
  ];

  // Check if campaign can be edited (draft or scheduled - not sent yet)
  const canEdit = isNew || campaign?.status === "draft" || campaign?.status === "scheduled";
  const showSendDetails = !isNew && campaign && ["running", "completed", "cancelled"].includes(campaign.status);

  const getStatusBadge = (status: Campaign["status"]) => {
    const config = {
      draft: { label: "Rascunho", variant: "secondary" as const, icon: Clock, className: "" },
      scheduled: { label: "Agendada", variant: "outline" as const, icon: Clock, className: "" },
      running: { label: "Enviando", variant: "default" as const, icon: Send, className: "" },
      completed: { label: "Concluída", variant: "default" as const, icon: CheckCircle2, className: "bg-success" },
      cancelled: { label: "Cancelada", variant: "destructive" as const, icon: XCircle, className: "" },
    };
    const cfg = config[status];
    return (
      <Badge variant={cfg.variant} className={cn("gap-1", cfg.className)}>
        <cfg.icon className={cn("h-3 w-3", status === "running" && "animate-pulse")} />
        {cfg.label}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/campaigns")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">
                  {isNew ? "Nova Campanha" : formData.name || "Campanha"}
                </h1>
                {campaign && getStatusBadge(campaign.status)}
              </div>
              <p className="text-sm text-muted-foreground">
                {showSendDetails 
                  ? "Visualize os detalhes de envio desta campanha" 
                  : activeTab === "config" 
                    ? "Configure sua campanha" 
                    : "Monte sua sequência de mensagens"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {canEdit && activeTab === "messages" && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
            )}
          </div>
        </div>

        {/* Show Send Details for non-draft campaigns */}
        {showSendDetails ? (
          <div className="space-y-6">
            {/* Campaign Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Resumo da Campanha
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Descrição</p>
                    <p className="font-medium">{formData.description || "Sem descrição"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Grupos selecionados</p>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{selectedGroups.length} grupos</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Instâncias</p>
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{selectedInstances.length} instância(s)</span>
                    </div>
                  </div>
                </div>
                {campaign?.scheduled_at && (
                  <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <span className="text-sm">
                      {campaign.status === "scheduled" ? "Agendada para: " : "Enviada em: "}
                      <strong>
                        {format(new Date(campaign.scheduled_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </strong>
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Messages Preview (Read-only) */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Mensagens da Campanha ({items.length})
                  </CardTitle>
                  <Badge variant="outline">
                    <Eye className="h-3 w-3 mr-1" />
                    Somente visualização
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 lg:grid-cols-2">
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <div key={item.id} className="p-4 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="gap-1">
                              {item.item_type === "text" && <Type className="h-3 w-3" />}
                              {item.item_type === "media" && <Image className="h-3 w-3" />}
                              {item.item_type === "poll" && <BarChart2 className="h-3 w-3" />}
                              {item.item_type === "text" ? "Texto" : item.item_type === "media" ? "Mídia" : "Enquete"} #{index + 1}
                            </Badge>
                          </div>
                          {item.item_type === "text" && (
                            <p className="text-sm whitespace-pre-wrap">{item.text_content}</p>
                          )}
                          {item.item_type === "media" && (
                            <div className="space-y-2">
                              {item.media_url && (
                                <div className="rounded-lg overflow-hidden max-w-[200px]">
                                  {item.media_type === "image" && (
                                    <img src={item.media_url} alt="Mídia" className="w-full h-auto" />
                                  )}
                                  {item.media_type === "video" && (
                                    <video src={item.media_url} controls className="w-full h-auto" />
                                  )}
                                  {item.media_type === "document" && (
                                    <div className="p-2 bg-muted rounded text-xs">{item.media_filename}</div>
                                  )}
                                </div>
                              )}
                              {item.media_caption && (
                                <p className="text-sm text-muted-foreground">{item.media_caption}</p>
                              )}
                            </div>
                          )}
                          {item.item_type === "poll" && (
                            <div className="space-y-2">
                              <p className="font-medium text-sm">{item.poll_question}</p>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {(item.poll_options || []).filter(o => o.trim()).map((opt, i) => (
                                  <li key={i}>• {opt}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="lg:sticky lg:top-0">
                    <div
                      className="rounded-lg overflow-hidden min-h-[300px] max-h-[400px] overflow-y-auto"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5ddd5' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                        backgroundColor: "#e5ddd5",
                      }}
                    >
                      <WhatsAppPreview items={items} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Send Details */}
            <CampaignSendDetails campaignId={id!} campaignStatus={campaign!.status} />
          </div>
        ) : (
          <>
            {/* Step Progress Indicator */}
            <div className="max-w-md">
              <FormStepIndicator
                steps={campaignSteps}
                currentStep={activeTab === "config" ? 0 : 1}
                onStepClick={(index) => {
                  if (index === 0) setActiveTab("config");
                  else if (index === 1 && isConfigComplete) setActiveTab("messages");
                }}
              />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="config" className="gap-2">
                  <Settings className="h-4 w-4" />
                  1. Configurações
                  {isConfigComplete && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                </TabsTrigger>
                <TabsTrigger value="messages" className="gap-2" disabled={!isConfigComplete}>
                  <MessageSquare className="h-4 w-4" />
                  2. Mensagens
                  {!isConfigComplete && <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                </TabsTrigger>
              </TabsList>

          {/* Step 1: Configuration */}
          <TabsContent value="config" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <Card className={cn(
                  "transition-all",
                  showValidationErrors && validationErrors.name && "border-destructive"
                )}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Informações Básicas</CardTitle>
                        <CardDescription>Dados principais da campanha</CardDescription>
                      </div>
                      <SectionStatus isComplete={!!formData.name.trim()} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RequiredField
                      label="Nome da Campanha"
                      required
                      isValid={showValidationErrors ? !validationErrors.name : undefined}
                      errorMessage={showValidationErrors && validationErrors.name ? "Campo obrigatório" : undefined}
                      helpText="Use um nome que identifique facilmente esta campanha"
                    >
                      <Input
                        id="name"
                        placeholder="Ex: Black Friday 2024, Promoção Janeiro..."
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className={cn(
                          showValidationErrors && validationErrors.name && "border-destructive focus-visible:ring-destructive"
                        )}
                      />
                    </RequiredField>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição (opcional)</Label>
                      <Input
                        id="description"
                        placeholder="Objetivo da campanha..."
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="delay-items">Delay entre mensagens (s)</Label>
                        <Input
                          id="delay-items"
                          type="number"
                          min={1}
                          max={60}
                          value={formData.delay_between_items}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              delay_between_items: parseInt(e.target.value) || 2,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="delay-groups">Delay entre grupos (s)</Label>
                        <Input
                          id="delay-groups"
                          type="number"
                          min={1}
                          max={3600}
                          value={formData.delay_between_groups}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              delay_between_groups: parseInt(e.target.value) || 3,
                            })
                          }
                        />
                        {formData.delay_between_groups > 60 && (
                          <p className="text-[10px] text-orange-500 flex items-center gap-1 mt-1 leading-tight">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>Delays &gt; 60s podem causar timeout na execução automática.</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn(
                  "transition-all",
                  showValidationErrors && validationErrors.instances && "border-destructive"
                )}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Instâncias WhatsApp</CardTitle>
                        <CardDescription>
                          Selecione as instâncias para envio. Com múltiplas, os envios são distribuídos.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <SectionStatus 
                          isComplete={selectedInstances.length > 0}
                          label={selectedInstances.length > 0 ? `${selectedInstances.length} selecionada(s)` : "Pendente"}
                        />
                        <Button variant="outline" size="sm" onClick={() => setInstancesDialogOpen(true)}>
                          <Smartphone className="h-4 w-4 mr-1" />
                          Selecionar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selectedInstances.length === 0 ? (
                      <div className={cn(
                        "text-center py-4 border-2 border-dashed rounded-lg",
                        showValidationErrors && validationErrors.instances 
                          ? "border-destructive bg-destructive/5" 
                          : "border-warning/50 bg-warning/5"
                      )}>
                        <AlertCircle className={cn(
                          "h-8 w-8 mx-auto mb-2",
                          showValidationErrors && validationErrors.instances ? "text-destructive" : "text-warning"
                        )} />
                        <p className={cn(
                          "text-sm",
                          showValidationErrors && validationErrors.instances ? "text-destructive font-medium" : "text-muted-foreground"
                        )}>
                          {showValidationErrors && validationErrors.instances 
                            ? "Selecione pelo menos uma instância" 
                            : "Nenhuma instância selecionada"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Clique em "Selecionar" para escolher
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {instances
                          .filter((i) => selectedInstances.includes(i.id))
                          .map((inst) => (
                            <div
                              key={inst.id}
                              className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
                            >
                              <Smartphone className="h-3 w-3" />
                              <span>{inst.nickname || inst.name}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className={cn(
                  "transition-all",
                  showValidationErrors && validationErrors.groups && "border-destructive"
                )}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Grupos de Destino</CardTitle>
                        <CardDescription>
                          Selecione os grupos que receberão a campanha
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <SectionStatus 
                          isComplete={selectedGroups.length > 0}
                          label={selectedGroups.length > 0 ? `${selectedGroups.length} grupo(s)` : "Pendente"}
                        />
                        <Button variant="outline" size="sm" onClick={() => setGroupsDialogOpen(true)}>
                          <Users className="h-4 w-4 mr-1" />
                          Selecionar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selectedGroups.length === 0 ? (
                      <div className={cn(
                        "text-center py-4 border-2 border-dashed rounded-lg",
                        showValidationErrors && validationErrors.groups 
                          ? "border-destructive bg-destructive/5" 
                          : "border-warning/50 bg-warning/5"
                      )}>
                        <AlertCircle className={cn(
                          "h-8 w-8 mx-auto mb-2",
                          showValidationErrors && validationErrors.groups ? "text-destructive" : "text-warning"
                        )} />
                        <p className={cn(
                          "text-sm",
                          showValidationErrors && validationErrors.groups ? "text-destructive font-medium" : "text-muted-foreground"
                        )}>
                          {showValidationErrors && validationErrors.groups 
                            ? "Selecione pelo menos um grupo" 
                            : "Nenhum grupo selecionado"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Clique em "Selecionar" para escolher os grupos
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-[200px]">
                        <div className="flex flex-wrap gap-2">
                          {groups
                            .filter((g) => selectedGroups.includes(g.id))
                            .map((group) => (
                              <div
                                key={group.id}
                                className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-full text-sm"
                              >
                                <Users className="h-3 w-3" />
                                <span>{group.name}</span>
                                <span className="text-xs opacity-70">({group.member_count})</span>
                              </div>
                            ))}
                        </div>
                      </ScrollArea>
                    )}
                    
                    {/* Unreachable groups warning */}
                    {selectedGroups.length > 0 && groupAnalysis.unreachableGroups.length > 0 && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Grupos sem instância selecionada</AlertTitle>
                        <AlertDescription>
                          <p className="mb-2">
                            {groupAnalysis.unreachableGroups.length} grupo(s) não serão enviados pois não têm acesso às instâncias selecionadas:
                          </p>
                          <ul className="text-xs space-y-1">
                            {groupAnalysis.unreachableGroups.slice(0, 3).map(g => (
                              <li key={g.id}>• {g.name}</li>
                            ))}
                            {groupAnalysis.unreachableGroups.length > 3 && (
                              <li>• ...e mais {groupAnalysis.unreachableGroups.length - 3}</li>
                            )}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Instance distribution info */}
                    {selectedGroups.length > 0 && groupAnalysis.reachableGroups.length > 0 && Object.keys(groupAnalysis.instanceDistribution).length > 1 && (
                      <Alert className="mt-4">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Distribuição por instância</AlertTitle>
                        <AlertDescription>
                          <p className="text-xs mb-2">
                            Cada grupo será enviado por uma instância aleatória com acesso:
                          </p>
                          <ul className="text-xs space-y-1">
                            {Object.entries(groupAnalysis.instanceDistribution).map(([id, { name, count }]) => (
                              <li key={id} className="flex items-center gap-2">
                                <Smartphone className="h-3 w-3" />
                                <span>{name}: até {count} grupos</span>
                              </li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Scheduling Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Agendamento</CardTitle>
                        <CardDescription>Opcional: agende o envio</CardDescription>
                      </div>
                      <Switch
                        id="schedule-toggle"
                        checked={isScheduled}
                        onCheckedChange={setIsScheduled}
                      />
                    </div>
                  </CardHeader>
                  {isScheduled && (
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Data de envio</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !scheduledDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {scheduledDate
                                  ? format(scheduledDate, "dd/MM/yyyy", { locale: ptBR })
                                  : "Selecione a data"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={scheduledDate}
                                onSelect={setScheduledDate}
                                disabled={(date) => {
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  return date < today;
                                }}
                                initialFocus
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="scheduled-time">Horário</Label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="scheduled-time"
                              type="time"
                              value={scheduledTime}
                              onChange={(e) => setScheduledTime(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>
                      </div>
                      {scheduledDate && (
                        <p className="text-sm text-muted-foreground">
                          A campanha será enviada em{" "}
                          <span className="font-medium text-foreground">
                            {format(scheduledDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} às {scheduledTime}
                          </span>
                        </p>
                      )}
                    </CardContent>
                  )}
                </Card>
              </div>
            </div>

            {/* Next Step Button */}
            <div className="flex justify-end">
              <Button onClick={handleNextStep} size="lg" className="gap-2">
                Próximo: Criar Mensagens
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Step 2: Messages */}
          <TabsContent value="messages" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Editor Column */}
              <div className="space-y-4">
                {/* Add Message Buttons */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        Sequência de Mensagens ({items.length})
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addItem("text")}
                        >
                          <Type className="h-4 w-4 mr-1" />
                          Texto
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addItem("media")}
                        >
                          <Image className="h-4 w-4 mr-1" />
                          Mídia
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addItem("poll")}
                        >
                          <BarChart2 className="h-4 w-4 mr-1" />
                          Enquete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        {items.map((item, index) => (
                          <CampaignItemEditor
                            key={item.id}
                            item={item}
                            index={index}
                            onChange={(updated) => updateItem(index, updated)}
                            onDelete={() => deleteItem(index)}
                            onMoveUp={() => moveItem(index, "up")}
                            onMoveDown={() => moveItem(index, "down")}
                            isFirst={index === 0}
                            isLast={index === items.length - 1}
                            campaignId={id || "new"}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </CardContent>
                </Card>

                {/* Save Button for Messages */}
                <div className="flex justify-between items-center">
                  <Button variant="outline" onClick={() => setActiveTab("config")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                  <Button onClick={handleSave} disabled={saving} size="lg">
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar Campanha
                  </Button>
                </div>
              </div>

              {/* Preview Column */}
              <div className="lg:sticky lg:top-20 h-fit">
                <Card className="overflow-hidden">
                  <CardHeader className="pb-2 bg-primary text-primary-foreground">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5" />
                      <CardTitle className="text-lg">Preview WhatsApp</CardTitle>
                    </div>
                    <CardDescription className="text-primary-foreground/80">
                      Visualização da sequência
                    </CardDescription>
                  </CardHeader>
                  <div
                    className="min-h-[400px] max-h-[600px] overflow-y-auto"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5ddd5' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                      backgroundColor: "#e5ddd5",
                    }}
                  >
                    <WhatsAppPreview items={items} />
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
          </>
        )}
        <Dialog open={groupsDialogOpen} onOpenChange={setGroupsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Selecionar Grupos</DialogTitle>
              <DialogDescription>
                Escolha os grupos que receberão esta campanha.
                {selectedInstances.length > 0 && (
                  <span className="block mt-1 text-primary">
                    Grupos com acesso às instâncias selecionadas são destacados.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2 p-1">
                {groups.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum grupo disponível
                  </p>
                ) : (
                  groups.map((group) => {
                    const groupInstanceIds = [
                      ...(group.group_instances?.map(gi => gi.instance_id) || []),
                      ...(group.instance_id ? [group.instance_id] : [])
                    ];
                    const hasSelectedInstance = selectedInstances.length === 0 || 
                      selectedInstances.some(instId => groupInstanceIds.includes(instId));
                    const instanceNames = group.group_instances
                      ?.map(gi => gi.whatsapp_instances?.nickname || gi.whatsapp_instances?.name)
                      .filter(Boolean) || [];
                    
                    return (
                      <div
                        key={group.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-all",
                          !hasSelectedInstance && "opacity-50 border-dashed",
                          selectedGroups.includes(group.id) && hasSelectedInstance && "border-primary bg-primary/5",
                          selectedGroups.includes(group.id) && !hasSelectedInstance && "border-destructive bg-destructive/5"
                        )}
                        onClick={() => toggleGroup(group.id)}
                      >
                        <Checkbox checked={selectedGroups.includes(group.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{group.name}</p>
                            {!hasSelectedInstance && selectedInstances.length > 0 && (
                              <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-muted-foreground">
                              {group.member_count} membros
                            </p>
                            {instanceNames.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Smartphone className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {instanceNames.slice(0, 2).join(", ")}
                                  {instanceNames.length > 2 && ` +${instanceNames.length - 2}`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  // Select only groups that have access to selected instances
                  const selectableGroups = selectedInstances.length === 0 
                    ? groups 
                    : groups.filter(g => {
                        const groupInstanceIds = g.group_instances?.map(gi => gi.instance_id) || [];
                        return selectedInstances.some(instId => groupInstanceIds.includes(instId));
                      });
                  setSelectedGroups(selectableGroups.map(g => g.id));
                }}
                className="text-xs"
              >
                Selecionar compatíveis
              </Button>
              <Button variant="outline" onClick={() => setGroupsDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Instances Dialog */}
        <Dialog open={instancesDialogOpen} onOpenChange={setInstancesDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Selecionar Instâncias</DialogTitle>
              <DialogDescription>
                Escolha as instâncias WhatsApp para envio. Com múltiplas instâncias, os envios são distribuídos aleatoriamente.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2 p-1">
                {instances.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhuma instância conectada
                  </p>
                ) : (
                  instances.map((inst) => (
                    <div
                      key={inst.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleInstance(inst.id)}
                    >
                      <Checkbox checked={selectedInstances.includes(inst.id)} />
                      <div className="flex-1">
                        <p className="font-medium">{inst.nickname || inst.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {inst.status === "connected" ? "✓ Conectada" : "⚠ Desconectada"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedInstances(instances.map(i => i.id))}
                className="text-xs"
              >
                Selecionar todas
              </Button>
              <Button variant="outline" onClick={() => setInstancesDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}