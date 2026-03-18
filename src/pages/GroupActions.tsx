import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { FormStepIndicator, Step } from "@/components/ui/form-step-indicator";
import { RequiredField } from "@/components/ui/required-field";
import { OnboardingCard } from "@/components/ui/onboarding-card";
import { ValidationSummary, SectionStatus } from "@/components/ui/validation-summary";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  Plus,
  Calendar,
  Clock,
  Type,
  FileText,
  Image,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PlayCircle,
  Trash2,
  History,
  Settings2,
  Copy,
  Pencil,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Users,
  Zap,
} from "lucide-react";

interface WhatsAppInstance {
  id: string;
  name: string;
  status: string;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  instance_id: string;
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
  group_action_targets: {
    id: string;
    group_id: string;
    status: string;
    error_message: string | null;
    groups: { name: string } | null;
  }[];
}

type ActionType = "name" | "description" | "photo";

export default function GroupActions() {
  const { user, loading: authLoading } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const navigate = useNavigate();
  const [actions, setActions] = useState<GroupAction[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Wizard step state
  const [currentStep, setCurrentStep] = useState(0);
  
  // Form state
  const [selectedInstance, setSelectedInstance] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedActionTypes, setSelectedActionTypes] = useState<Set<ActionType>>(new Set());
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [preserveNameSuffix, setPreserveNameSuffix] = useState(true);
  const [isImmediate, setIsImmediate] = useState(true);
  const [editingAction, setEditingAction] = useState<GroupAction | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "duplicate">("create");

  // Validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showStepErrors, setShowStepErrors] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, effectiveUserId]);

  useEffect(() => {
    if (selectedInstance) {
      fetchGroups(selectedInstance);
    } else {
      setGroups([]);
      setSelectedGroups([]);
    }
  }, [selectedInstance]);

  const fetchData = async () => {
    try {
      const [actionsResult, instancesResult] = await Promise.all([
        supabase
          .from("group_actions")
          .select(`
            *,
            whatsapp_instances (name),
            group_action_targets (
              id,
              group_id,
              status,
              error_message,
              groups (name)
            )
          `)
          .eq("user_id", effectiveUserId)
          .order("created_at", { ascending: false }),
        supabase
          .from("whatsapp_instances")
          .select("id, name, status")
          .eq("user_id", effectiveUserId)
          .eq("status", "connected")
      ]);

      if (actionsResult.error) throw actionsResult.error;
      if (instancesResult.error) throw instancesResult.error;

      setActions(actionsResult.data as unknown as GroupAction[] || []);
      const fetchedInstances = instancesResult.data || [];
      setInstances(fetchedInstances);
      
      // Auto-select if only one instance
      if (fetchedInstances.length === 1) {
        setSelectedInstance(fetchedInstances[0].id);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async (instanceId: string) => {
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, description, photo_url, instance_id")
        .eq("user_id", effectiveUserId)
        .eq("instance_id", instanceId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      const fetchedGroups = data || [];
      setGroups(fetchedGroups);
      
      // Auto-select if only one group
      if (fetchedGroups.length === 1) {
        setSelectedGroups([fetchedGroups[0].id]);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
      toast.error("Erro ao carregar grupos");
    }
  };

  const handleCreateActions = async () => {
    if (!selectedInstance || selectedGroups.length === 0) {
      toast.error("Selecione uma instância e pelo menos um grupo");
      return;
    }

    if (selectedActionTypes.size === 0) {
      toast.error("Selecione pelo menos um tipo de ação");
      return;
    }

    // Validate each selected action type
    for (const actionType of selectedActionTypes) {
      if (actionType === "name" && !newName.trim()) {
        toast.error("Preencha o novo nome");
        return;
      }
      if (actionType === "description" && !newDescription.trim()) {
        toast.error("Preencha a nova descrição");
        return;
      }
      if (actionType === "photo" && !photoFile) {
        toast.error("Selecione uma foto");
        return;
      }
    }

    if (!isImmediate && (!scheduledDate || !scheduledTime)) {
      toast.error("Preencha a data e hora do agendamento");
      return;
    }

    setIsSaving(true);

    try {
      let photoUrl: string | null = null;

      // Upload photo if needed
      if (selectedActionTypes.has("photo") && photoFile) {
        const fileExt = photoFile.name.split(".").pop();
        const filePath = `${user!.id}/group-photos/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("assets")
          .upload(filePath, photoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("assets")
          .getPublicUrl(filePath);
        
        photoUrl = urlData.publicUrl;
      }

      // Determine scheduled time
      const scheduledAt = isImmediate
        ? new Date().toISOString()
        : new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

      // Create action for each selected type
      const actionTypes = Array.from(selectedActionTypes);
      let createdCount = 0;

      for (const actionType of actionTypes) {
        let newValueText: string | null = null;
        let newValueFileUrl: string | null = null;

        if (actionType === "name") {
          newValueText = newName;
        } else if (actionType === "description") {
          newValueText = newDescription;
        } else if (actionType === "photo") {
          newValueFileUrl = photoUrl;
        }

        // Create the action with metadata for name suffix preservation
        const actionMetadata = actionType === "name" ? { preserveSuffix: preserveNameSuffix } : null;
        
        const { data: actionData, error: actionError } = await supabase
          .from("group_actions")
          .insert({
            user_id: user!.id,
            whatsapp_instance_id: selectedInstance,
            action_type: actionType,
            new_value_text: newValueText ? (actionType === "name" && preserveNameSuffix ? `${newValueText}{{PRESERVE_SUFFIX}}` : newValueText) : null,
            new_value_file_url: newValueFileUrl,
            scheduled_at: scheduledAt,
            status: "pending"
          })
          .select()
          .single();

        if (actionError) throw actionError;

        // Create targets for each selected group
        const targets = selectedGroups.map(groupId => ({
          action_id: actionData.id,
          group_id: groupId,
          status: "pending" as const
        }));

        const { error: targetsError } = await supabase
          .from("group_action_targets")
          .insert(targets);

        if (targetsError) throw targetsError;

        // If immediate, call the edge function to execute now
        if (isImmediate) {
          try {
            const { error: execError } = await supabase.functions.invoke('execute-group-actions', {
              body: { actionId: actionData.id }
            });
            
            if (execError) {
              console.error("Error triggering execution:", execError);
            }
          } catch (execError) {
            console.error("Error calling execute function:", execError);
          }
        }

        createdCount++;
      }

      toast.success(
        createdCount === 1
          ? (isImmediate ? "Ação criada e executada!" : "Ação agendada com sucesso!")
          : `${createdCount} ações ${isImmediate ? "criadas e executadas" : "agendadas"} com sucesso!`
      );
      
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error creating actions:", error);
      toast.error("Erro ao criar ações");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelAction = async (actionId: string) => {
    try {
      const { error } = await supabase
        .from("group_actions")
        .update({ status: "cancelled" })
        .eq("id", actionId)
        .eq("status", "pending");

      if (error) throw error;

      toast.success("Ação cancelada");
      fetchData();
    } catch (error) {
      console.error("Error cancelling action:", error);
      toast.error("Erro ao cancelar ação");
    }
  };

  const resetForm = () => {
    setSelectedInstance("");
    setSelectedGroups([]);
    setSelectedActionTypes(new Set());
    setNewName("");
    setNewDescription("");
    setPhotoFile(null);
    setScheduledDate("");
    setScheduledTime("");
    setIsImmediate(true);
    setEditingAction(null);
    setDialogMode("create");
    setCurrentStep(0);
    setTouched({});
    setShowStepErrors(false);
    setPreserveNameSuffix(true);
  };

  const handleEditAction = (action: GroupAction) => {
    setEditingAction(action);
    setDialogMode("edit");
    setSelectedInstance(action.whatsapp_instance_id);
    setSelectedActionTypes(new Set([action.action_type]));
    if (action.action_type === "name") {
      setNewName(action.new_value_text || "");
    } else if (action.action_type === "description") {
      setNewDescription(action.new_value_text || "");
    }
    setSelectedGroups(action.group_action_targets.map(t => t.group_id));
    
    const scheduledDate = new Date(action.scheduled_at);
    setScheduledDate(scheduledDate.toISOString().split("T")[0]);
    setScheduledTime(scheduledDate.toTimeString().slice(0, 5));
    setIsImmediate(false);
    setCurrentStep(0);
    setIsDialogOpen(true);
  };

  const handleDuplicateAction = (action: GroupAction) => {
    setEditingAction(action);
    setDialogMode("duplicate");
    setSelectedInstance(action.whatsapp_instance_id);
    setSelectedActionTypes(new Set([action.action_type]));
    if (action.action_type === "name") {
      setNewName(action.new_value_text || "");
    } else if (action.action_type === "description") {
      setNewDescription(action.new_value_text || "");
    }
    setSelectedGroups(action.group_action_targets.map(t => t.group_id));
    setIsImmediate(true);
    setScheduledDate("");
    setScheduledTime("");
    setCurrentStep(0);
    setIsDialogOpen(true);
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups(prev => 
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const selectAllGroups = () => {
    if (selectedGroups.length === groups.length) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups(groups.map(g => g.id));
    }
  };

  const toggleActionType = (type: ActionType) => {
    setSelectedActionTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const selectAllActionTypes = () => {
    if (selectedActionTypes.size === 3) {
      setSelectedActionTypes(new Set());
    } else {
      setSelectedActionTypes(new Set(["name", "description", "photo"]));
    }
  };

  // Wizard steps configuration
  const wizardSteps: Step[] = [
    {
      id: "instance",
      label: "Instância",
      icon: <Smartphone className="h-4 w-4" />,
      isComplete: !!selectedInstance,
    },
    {
      id: "groups",
      label: "Grupos",
      icon: <Users className="h-4 w-4" />,
      isComplete: selectedGroups.length > 0,
      isDisabled: !selectedInstance,
    },
    {
      id: "actions",
      label: "Ações",
      icon: <Zap className="h-4 w-4" />,
      isComplete: selectedActionTypes.size > 0,
      isDisabled: selectedGroups.length === 0,
    },
    {
      id: "values",
      label: "Valores",
      icon: <Type className="h-4 w-4" />,
      isComplete: validateValues(),
      isDisabled: selectedActionTypes.size === 0,
    },
    {
      id: "schedule",
      label: "Agendar",
      icon: <Calendar className="h-4 w-4" />,
      isComplete: isImmediate || (!!scheduledDate && !!scheduledTime),
      isDisabled: !validateValues(),
    },
  ];

  function validateValues(): boolean {
    if (selectedActionTypes.size === 0) return false;
    
    for (const type of selectedActionTypes) {
      if (type === "name" && !newName.trim()) return false;
      if (type === "description" && !newDescription.trim()) return false;
      if (type === "photo" && !photoFile) return false;
    }
    return true;
  }

  const canProceedToNextStep = (): boolean => {
    switch (currentStep) {
      case 0: return !!selectedInstance;
      case 1: return selectedGroups.length > 0;
      case 2: return selectedActionTypes.size > 0;
      case 3: return validateValues();
      case 4: return isImmediate || (!!scheduledDate && !!scheduledTime);
      default: return false;
    }
  };

  const handleNextStep = () => {
    if (canProceedToNextStep() && currentStep < wizardSteps.length - 1) {
      setShowStepErrors(false);
      setCurrentStep(prev => prev + 1);
    } else {
      setShowStepErrors(true);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setShowStepErrors(false);
      setCurrentStep(prev => prev - 1);
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
        return <Type className="h-4 w-4" />;
      case "description":
        return <FileText className="h-4 w-4" />;
      case "photo":
        return <Image className="h-4 w-4" />;
      default:
        return <Settings2 className="h-4 w-4" />;
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
            <h1 className="text-3xl font-bold tracking-tight">Ações de Grupo</h1>
            <p className="text-muted-foreground">
              Altere nome, descrição e foto de grupos com agendamento
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setDialogMode("create")}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Ação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {dialogMode === "edit" ? "Editar Ação" : dialogMode === "duplicate" ? "Duplicar Ação" : "Criar Nova Ação de Grupo"}
                </DialogTitle>
                <DialogDescription>
                  Siga os passos para configurar a ação
                </DialogDescription>
              </DialogHeader>

              {/* Step Indicator */}
              <div className="py-4 border-b">
                <FormStepIndicator
                  steps={wizardSteps}
                  currentStep={currentStep}
                  onStepClick={(index) => {
                    // Only allow clicking completed or current steps
                    if (index <= currentStep || wizardSteps[index - 1]?.isComplete) {
                      setCurrentStep(index);
                    }
                  }}
                />
              </div>

              <div className="space-y-6 py-4">
                {/* Step 1: Instance Selection */}
                {currentStep === 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-semibold">
                      <Smartphone className="h-5 w-5 text-primary" />
                      Selecione a Instância WhatsApp
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Escolha qual conexão WhatsApp será usada para executar as ações
                    </p>
                    
                    {instances.length === 0 ? (
                      <OnboardingCard
                        variant="compact"
                        icon={Smartphone}
                        title="Nenhuma instância conectada"
                        description="Conecte uma instância WhatsApp para continuar"
                        actionLabel="Ir para Instâncias"
                        onAction={() => navigate("/dashboard/instances")}
                      />
                    ) : (
                      <div className="grid gap-3">
                        {instances.map((instance) => (
                          <Card
                            key={instance.id}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                              selectedInstance === instance.id
                                ? "border-primary bg-primary/5 ring-2 ring-primary"
                                : "hover:border-primary/50"
                            }`}
                            onClick={() => setSelectedInstance(instance.id)}
                          >
                            <CardContent className="flex items-center gap-3 p-4">
                              <div className={`p-2 rounded-full ${
                                selectedInstance === instance.id
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}>
                                <Smartphone className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{instance.name}</p>
                                <p className="text-xs text-muted-foreground">Conectado</p>
                              </div>
                              {selectedInstance === instance.id && (
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                    
                    {showStepErrors && !selectedInstance && instances.length > 0 && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        Selecione uma instância para continuar
                      </p>
                    )}
                  </div>
                )}

                {/* Step 2: Groups Selection */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-lg font-semibold">
                          <Users className="h-5 w-5 text-primary" />
                          Selecione os Grupos
                        </div>
                        <p className="text-sm text-muted-foreground">
                          As ações serão aplicadas a todos os grupos selecionados
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={selectAllGroups}>
                        {selectedGroups.length === groups.length ? "Desmarcar todos" : "Selecionar todos"}
                      </Button>
                    </div>
                    
                    {groups.length === 0 ? (
                      <OnboardingCard
                        variant="compact"
                        icon={Users}
                        title="Nenhum grupo encontrado"
                        description="Sincronize os grupos da instância selecionada"
                        actionLabel="Ir para Grupos"
                        onAction={() => navigate("/dashboard/groups")}
                      />
                    ) : (
                      <>
                        <div className="text-sm font-medium text-primary">
                          {selectedGroups.length} de {groups.length} grupo(s) selecionado(s)
                        </div>
                        <div className={`border rounded-lg max-h-64 overflow-y-auto divide-y ${
                          showStepErrors && selectedGroups.length === 0 ? "border-destructive" : ""
                        }`}>
                          {groups.map((group) => (
                            <div
                              key={group.id}
                              className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                                selectedGroups.includes(group.id)
                                  ? "bg-primary/5"
                                  : "hover:bg-muted/50"
                              }`}
                              onClick={() => toggleGroupSelection(group.id)}
                            >
                              <Checkbox
                                checked={selectedGroups.includes(group.id)}
                                onCheckedChange={() => toggleGroupSelection(group.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{group.name}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {showStepErrors && selectedGroups.length === 0 && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            Selecione pelo menos um grupo para continuar
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Step 3: Action Types Selection */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-lg font-semibold">
                          <Zap className="h-5 w-5 text-primary" />
                          Tipos de Ação
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Selecione o que deseja alterar nos grupos. Você pode selecionar múltiplas ações!
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={selectAllActionTypes}>
                        {selectedActionTypes.size === 3 ? "Desmarcar todos" : "Selecionar todos"}
                      </Button>
                    </div>
                    
                    <div className="grid gap-3 sm:grid-cols-3">
                      {([
                        { type: "name" as const, label: "Alterar Nome", icon: Type, description: "Mude o nome exibido do grupo" },
                        { type: "description" as const, label: "Alterar Descrição", icon: FileText, description: "Atualize a descrição do grupo" },
                        { type: "photo" as const, label: "Alterar Foto", icon: Image, description: "Troque a foto de perfil do grupo" },
                      ]).map(({ type, label, icon: Icon, description }) => (
                        <Card
                          key={type}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            selectedActionTypes.has(type)
                              ? "border-primary bg-primary/5 ring-2 ring-primary"
                              : showStepErrors && selectedActionTypes.size === 0
                              ? "border-destructive"
                              : "hover:border-primary/50"
                          }`}
                          onClick={() => toggleActionType(type)}
                        >
                          <CardContent className="p-4 text-center space-y-2">
                            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
                              selectedActionTypes.has(type)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}>
                              <Icon className="h-6 w-6" />
                            </div>
                            <p className="font-medium">{label}</p>
                            <p className="text-xs text-muted-foreground">{description}</p>
                            {selectedActionTypes.has(type) && (
                              <CheckCircle2 className="h-5 w-5 text-primary mx-auto" />
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {showStepErrors && selectedActionTypes.size === 0 && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        Selecione pelo menos um tipo de ação para continuar
                      </p>
                    )}

                    {selectedActionTypes.size > 1 && (
                      <div className="p-3 bg-primary/5 rounded-lg text-sm">
                        <p className="text-primary font-medium">
                          ✨ {selectedActionTypes.size} ações selecionadas
                        </p>
                        <p className="text-muted-foreground">
                          Serão criadas {selectedActionTypes.size} ações separadas para os {selectedGroups.length} grupo(s) selecionado(s).
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Values */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 text-lg font-semibold">
                        <Type className="h-5 w-5 text-primary" />
                        Defina os Novos Valores
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Preencha os valores para cada tipo de ação selecionado
                      </p>
                    </div>

                    {selectedActionTypes.has("name") && (
                      <div className="space-y-4">
                        <RequiredField
                          label="Novo Nome"
                          required
                          isValid={!!newName.trim()}
                          showValidation={touched.name || showStepErrors}
                          errorMessage={(touched.name || showStepErrors) && !newName.trim() ? "O nome é obrigatório" : undefined}
                          helpText="Este nome será aplicado a todos os grupos selecionados"
                        >
                          <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                            placeholder="Digite o novo nome do grupo..."
                            className={(touched.name || showStepErrors) && !newName.trim() ? "border-destructive" : ""}
                          />
                        </RequiredField>
                        
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border">
                          <Checkbox
                            id="preserve-suffix"
                            checked={preserveNameSuffix}
                            onCheckedChange={(checked) => setPreserveNameSuffix(checked === true)}
                          />
                          <div className="flex-1 space-y-1">
                            <Label htmlFor="preserve-suffix" className="cursor-pointer font-medium">
                              Manter sufixo após # (ex: #01, #02)
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              O texto após o # será preservado para diferenciar os grupos.
                              <br />
                              Exemplo: "{newName || "Novo Nome"}" → "{newName || "Novo Nome"} #04👕"
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedActionTypes.has("description") && (
                      <RequiredField
                        label="Nova Descrição"
                        required
                        isValid={!!newDescription.trim()}
                        showValidation={touched.description || showStepErrors}
                        errorMessage={(touched.description || showStepErrors) && !newDescription.trim() ? "A descrição é obrigatória" : undefined}
                        helpText="Esta descrição será aplicada a todos os grupos selecionados"
                      >
                        <Textarea
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          onBlur={() => setTouched(prev => ({ ...prev, description: true }))}
                          placeholder="Digite a nova descrição..."
                          rows={4}
                          className={(touched.description || showStepErrors) && !newDescription.trim() ? "border-destructive" : ""}
                        />
                      </RequiredField>
                    )}

                    {selectedActionTypes.has("photo") && (
                      <RequiredField
                        label="Nova Foto"
                        required
                        isValid={!!photoFile}
                        showValidation={touched.photo || showStepErrors}
                        errorMessage={(touched.photo || showStepErrors) && !photoFile ? "Selecione uma foto" : undefined}
                        helpText="Esta foto será aplicada a todos os grupos selecionados"
                      >
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            setPhotoFile(e.target.files?.[0] || null);
                            setTouched(prev => ({ ...prev, photo: true }));
                          }}
                          className={(touched.photo || showStepErrors) && !photoFile ? "border-destructive" : ""}
                        />
                        {photoFile && (
                          <div className="mt-3 flex items-center gap-3">
                            <img
                              src={URL.createObjectURL(photoFile)}
                              alt="Preview"
                              className="w-16 h-16 object-cover rounded-lg border"
                            />
                            <div className="text-sm text-muted-foreground">
                              {photoFile.name}
                            </div>
                          </div>
                        )}
                      </RequiredField>
                    )}
                  </div>
                )}

                {/* Step 5: Scheduling */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 text-lg font-semibold">
                        <Calendar className="h-5 w-5 text-primary" />
                        Quando Executar?
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Escolha executar agora ou agende para depois
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Card
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          isImmediate
                            ? "border-primary bg-primary/5 ring-2 ring-primary"
                            : "hover:border-primary/50"
                        }`}
                        onClick={() => setIsImmediate(true)}
                      >
                        <CardContent className="p-4 text-center space-y-2">
                          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
                            isImmediate ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}>
                            <PlayCircle className="h-6 w-6" />
                          </div>
                          <p className="font-medium">Executar Agora</p>
                          <p className="text-xs text-muted-foreground">A ação será executada imediatamente</p>
                        </CardContent>
                      </Card>

                      <Card
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          !isImmediate
                            ? "border-primary bg-primary/5 ring-2 ring-primary"
                            : "hover:border-primary/50"
                        }`}
                        onClick={() => setIsImmediate(false)}
                      >
                        <CardContent className="p-4 text-center space-y-2">
                          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
                            !isImmediate ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}>
                            <Clock className="h-6 w-6" />
                          </div>
                          <p className="font-medium">Agendar</p>
                          <p className="text-xs text-muted-foreground">Escolha data e hora para executar</p>
                        </CardContent>
                      </Card>
                    </div>

                    {!isImmediate && (
                      <div className={`grid gap-4 sm:grid-cols-2 p-4 border rounded-lg bg-muted/30 ${
                        showStepErrors && (!scheduledDate || !scheduledTime) ? "border-destructive" : ""
                      }`}>
                        <RequiredField
                          label="Data"
                          required
                          isValid={!!scheduledDate}
                          showValidation={showStepErrors}
                          errorMessage={showStepErrors && !scheduledDate ? "Selecione uma data" : undefined}
                        >
                          <Input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            className={showStepErrors && !scheduledDate ? "border-destructive" : ""}
                          />
                        </RequiredField>
                        <RequiredField
                          label="Hora"
                          required
                          isValid={!!scheduledTime}
                          showValidation={showStepErrors}
                          errorMessage={showStepErrors && !scheduledTime ? "Selecione um horário" : undefined}
                        >
                          <Input
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            className={showStepErrors && !scheduledTime ? "border-destructive" : ""}
                          />
                        </RequiredField>
                      </div>
                    )}

                    {/* Summary */}
                    <Card className="bg-muted/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Resumo</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Instância:</span>
                          <span className="font-medium">{instances.find(i => i.id === selectedInstance)?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Grupos:</span>
                          <span className="font-medium">{selectedGroups.length} selecionado(s)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ações:</span>
                          <span className="font-medium">
                            {Array.from(selectedActionTypes).map(t => getActionTypeLabel(t)).join(", ")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Execução:</span>
                          <span className="font-medium">
                            {isImmediate ? "Imediata" : `${scheduledDate} às ${scheduledTime}`}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={currentStep === 0 ? () => setIsDialogOpen(false) : handlePreviousStep}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {currentStep === 0 ? "Cancelar" : "Voltar"}
                </Button>

                {currentStep < wizardSteps.length - 1 ? (
                  <Button onClick={handleNextStep} disabled={!canProceedToNextStep()}>
                    Próximo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    onClick={handleCreateActions} 
                    disabled={isSaving || !canProceedToNextStep()}
                    className="gap-2"
                  >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {selectedActionTypes.size > 1 
                      ? `Criar ${selectedActionTypes.size} Ações` 
                      : "Criar Ação"
                    }
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Onboarding for empty state */}
        {!loading && actions.length === 0 && instances.length > 0 && (
          <OnboardingCard
            variant="hero"
            icon={Settings2}
            title="Ações de Grupo"
            description="Altere nome, descrição e foto de múltiplos grupos de uma só vez. Agende para executar quando quiser!"
            steps={[
              { label: "Selecione a instância", isComplete: false },
              { label: "Escolha os grupos", isComplete: false },
              { label: "Defina as ações", isComplete: false },
            ]}
            actionLabel="Criar Primeira Ação"
            onAction={() => setIsDialogOpen(true)}
          />
        )}

        {/* No instance warning */}
        {!loading && instances.length === 0 && (
          <OnboardingCard
            variant="hero"
            icon={Smartphone}
            title="Conecte uma Instância"
            description="Para criar ações de grupo, você precisa ter pelo menos uma instância WhatsApp conectada."
            actionLabel="Ir para Instâncias"
            onAction={() => navigate("/dashboard/instances")}
          />
        )}

        {/* Actions List */}
        {!loading && actions.length > 0 && (
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="completed">Concluídas</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <ActionsList
                actions={actions}
                onCancel={handleCancelAction}
                onEdit={handleEditAction}
                onDuplicate={handleDuplicateAction}
                getStatusBadge={getStatusBadge}
                getActionTypeIcon={getActionTypeIcon}
                getActionTypeLabel={getActionTypeLabel}
              />
            </TabsContent>

            <TabsContent value="pending" className="space-y-4">
              <ActionsList
                actions={actions.filter(a => a.status === "pending")}
                onCancel={handleCancelAction}
                onEdit={handleEditAction}
                onDuplicate={handleDuplicateAction}
                getStatusBadge={getStatusBadge}
                getActionTypeIcon={getActionTypeIcon}
                getActionTypeLabel={getActionTypeLabel}
              />
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              <ActionsList
                actions={actions.filter(a => a.status === "completed")}
                onCancel={handleCancelAction}
                onEdit={handleEditAction}
                onDuplicate={handleDuplicateAction}
                getStatusBadge={getStatusBadge}
                getActionTypeIcon={getActionTypeIcon}
                getActionTypeLabel={getActionTypeLabel}
              />
            </TabsContent>
          </Tabs>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

interface ActionsListProps {
  actions: GroupAction[];
  onCancel: (id: string) => void;
  onEdit: (action: GroupAction) => void;
  onDuplicate: (action: GroupAction) => void;
  getStatusBadge: (status: string) => JSX.Element;
  getActionTypeIcon: (type: string) => JSX.Element;
  getActionTypeLabel: (type: string) => string;
}

function ActionsList({ actions, onCancel, onEdit, onDuplicate, getStatusBadge, getActionTypeIcon, getActionTypeLabel }: ActionsListProps) {
  const navigate = useNavigate();

  if (actions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Settings2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nenhuma ação</h3>
          <p className="text-muted-foreground text-center">
            Não há ações nesta categoria
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {actions.map((action) => (
        <Card key={action.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  {getActionTypeIcon(action.action_type)}
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Alterar {getActionTypeLabel(action.action_type)}
                    {getStatusBadge(action.status)}
                  </CardTitle>
                  <CardDescription>
                    {action.whatsapp_instances?.name} • {action.group_action_targets.length} grupo{action.group_action_targets.length !== 1 ? "s" : ""}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {action.status === "pending" && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(action)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onCancel(action.id)} title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" onClick={() => onDuplicate(action)} title="Duplicar">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/group-actions/${action.id}`)}>
                  <History className="mr-2 h-4 w-4" />
                  Detalhes
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {action.action_type !== "photo" && action.new_value_text && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground mb-1">Novo valor:</p>
                <p className="text-sm line-clamp-2">{action.new_value_text}</p>
              </div>
            )}

            {action.action_type === "photo" && action.new_value_file_url && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">Nova foto:</p>
                <img
                  src={action.new_value_file_url}
                  alt="Nova foto"
                  className="w-12 h-12 object-cover rounded-lg"
                />
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  Agendado: {format(new Date(action.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
              {action.executed_at && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    Executado: {format(new Date(action.executed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>

            {action.error_message && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                <strong>Erro:</strong> {action.error_message}
              </div>
            )}

            {/* Target groups preview */}
            <div className="flex flex-wrap gap-1">
              {action.group_action_targets.slice(0, 5).map((target) => (
                <Badge key={target.id} variant="outline" className="text-xs">
                  {target.groups?.name || "Grupo"}
                </Badge>
              ))}
              {action.group_action_targets.length > 5 && (
                <Badge variant="secondary" className="text-xs">
                  +{action.group_action_targets.length - 5} mais
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
