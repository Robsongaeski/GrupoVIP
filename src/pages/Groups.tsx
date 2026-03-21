import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import GroupHistory from "@/components/groups/GroupHistory";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OnboardingCard, TipCard } from "@/components/ui/onboarding-card";
import {
  Users,
  Search,
  RefreshCw,
  Loader2,
  ExternalLink,
  UserPlus,
  Copy,
  Settings2,
  Smartphone,
  Shield,
  Filter,
  Clock,
  Trash2,
  CheckSquare,
  Square,
  HelpCircle,
  Link,
  MessageSquare,
  Zap,
} from "lucide-react";

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
  description: string | null;
  photo_url: string | null;
  invite_link: string | null;
  member_count: number;
  max_members: number;
  is_active: boolean;
  is_user_admin: boolean;
  synced_at: string | null;
  whatsapp_instances: {
    name: string;
  } | null;
  group_instances?: GroupInstance[];
}

type FilterType = "all" | "admin" | "active";

interface WhatsAppInstance {
  id: string;
  name: string;
  status: string;
  nickname: string | null;
}

export default function Groups() {
  const { user, loading: authLoading } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [instanceFilter, setInstanceFilter] = useState<string>("all");
  const [onlyAdminSync, setOnlyAdminSync] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [adminSyncConfirmOpen, setAdminSyncConfirmOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGroups();
      fetchInstances();
    }
  }, [user, effectiveUserId]);

  const fetchInstances = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id, name, status, nickname")
        .eq("user_id", effectiveUserId)
        .eq("status", "connected")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInstances(data || []);
      
      // Auto-select first connected instance
      if (data && data.length > 0 && !selectedInstance) {
        setSelectedInstance(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching instances:", error);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("groups")
        .select(`
          *,
          whatsapp_instances (name),
          group_instances (
            instance_id,
            is_admin,
            whatsapp_instances (id, name, nickname)
          )
        `)
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error("Error fetching groups:", error);
      toast.error("Erro ao carregar grupos");
    } finally {
      setLoading(false);
    }
  };

  const syncGroups = async () => {
    if (!selectedInstance) {
      toast.error("Selecione uma instância conectada para sincronizar");
      return;
    }

    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const response = await supabase.functions.invoke("whatsapp-api", {
        body: {
          action: "fetch-groups",
          instanceId: selectedInstance,
          onlyAdmin: onlyAdminSync,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao sincronizar grupos");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success(response.data?.message || "Grupos sincronizados com sucesso!");
      await fetchGroups();
    } catch (error) {
      console.error("Error syncing groups:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao sincronizar grupos");
    } finally {
      setSyncing(false);
    }
  };

  const copyInviteLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const toggleGroupActive = async (groupId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("groups")
        .update({ is_active: !currentActive })
        .eq("id", groupId);

      if (error) throw error;

      setGroups(prev => 
        prev.map(g => g.id === groupId ? { ...g, is_active: !currentActive } : g)
      );
      toast.success(currentActive ? "Grupo desativado" : "Grupo ativado para uso no sistema");
    } catch (error) {
      console.error("Error toggling group:", error);
      toast.error("Erro ao atualizar grupo");
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      // Delete related records first to avoid FK constraints
      await supabase.from("send_logs").delete().eq("group_id", groupId);
      await supabase.from("link_clicks").delete().eq("group_id", groupId);
      await supabase.from("link_groups").delete().eq("group_id", groupId);
      await supabase.from("campaign_groups").delete().eq("group_id", groupId);
      await supabase.from("group_action_targets").delete().eq("group_id", groupId);
      await supabase.from("group_members").delete().eq("group_id", groupId);
      await supabase.from("group_snapshots").delete().eq("group_id", groupId);
      await supabase.from("group_instances").delete().eq("group_id", groupId);
      
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", groupId);

      if (error) throw error;

      setGroups(prev => prev.filter(g => g.id !== groupId));
      setSelectedGroups(prev => {
        const newSet = new Set(prev);
        newSet.delete(groupId);
        return newSet;
      });
      toast.success("Grupo removido da lista");
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Erro ao remover grupo");
    }
  };

  const deleteSelectedGroups = async () => {
    if (selectedGroups.size === 0) return;
    
    try {
      const groupIds = Array.from(selectedGroups);
      
      // Delete related records first to avoid FK constraints
      await supabase.from("send_logs").delete().in("group_id", groupIds);
      await supabase.from("link_clicks").delete().in("group_id", groupIds);
      await supabase.from("link_groups").delete().in("group_id", groupIds);
      await supabase.from("campaign_groups").delete().in("group_id", groupIds);
      await supabase.from("group_action_targets").delete().in("group_id", groupIds);
      await supabase.from("group_members").delete().in("group_id", groupIds);
      await supabase.from("group_snapshots").delete().in("group_id", groupIds);
      await supabase.from("group_instances").delete().in("group_id", groupIds);
      
      // Now delete the groups
      const { error } = await supabase
        .from("groups")
        .delete()
        .in("id", groupIds);

      if (error) throw error;

      setGroups(prev => prev.filter(g => !selectedGroups.has(g.id)));
      toast.success(`${selectedGroups.size} grupo(s) removido(s)`);
      setSelectedGroups(new Set());
      setIsMultiSelectMode(false);
    } catch (error) {
      console.error("Error deleting groups:", error);
      toast.error("Erro ao remover grupos");
    }
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedGroups.size === filteredGroups.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(filteredGroups.map(g => g.id)));
    }
  };

  const confirmDeleteGroup = (groupId: string) => {
    setGroupToDelete(groupId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (groupToDelete) {
      await deleteGroup(groupToDelete);
    } else if (selectedGroups.size > 0) {
      await deleteSelectedGroups();
    }
    setDeleteDialogOpen(false);
    setGroupToDelete(null);
  };

  const confirmDeleteSelected = () => {
    setGroupToDelete(null);
    setDeleteDialogOpen(true);
  };

  const getGroupInitials = (name: string) => {
    return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  };

  const filteredGroups = groups.filter((group) => {
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      filter === "all" ? true :
      filter === "admin" ? group.is_user_admin :
      filter === "active" ? group.is_active : true;
    const matchesInstance = 
      instanceFilter === "all" ? true :
      group.group_instances?.some(gi => gi.instance_id === instanceFilter) ?? false;
    return matchesSearch && matchesFilter && matchesInstance;
  });

  const getParticipantColor = (count: number) => {
    if (count >= 900) return "text-destructive";
    if (count >= 700) return "text-warning";
    return "text-muted-foreground";
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
            <h1 className="text-3xl font-bold tracking-tight">Grupos</h1>
            <p className="text-muted-foreground">
              Gerencie seus grupos do WhatsApp
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard/group-actions")}>
              <Settings2 className="mr-2 h-4 w-4" />
              Ações de Grupo
            </Button>
          </div>
        </div>

        {/* Sync Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2 flex-1">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Instância:</span>
                {instances.length > 0 ? (
                  <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Selecione uma instância" />
                    </SelectTrigger>
                    <SelectContent>
                      {instances.map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>
                          {instance.nickname || instance.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Nenhuma instância conectada
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="onlyAdminSync"
                  checked={onlyAdminSync}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setOnlyAdminSync(true);
                    } else {
                      setAdminSyncConfirmOpen(true);
                    }
                  }}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="onlyAdminSync" className="text-sm text-muted-foreground cursor-pointer">
                  Apenas grupos que sou admin
                </label>
              </div>
              <Button 
                onClick={syncGroups} 
                disabled={syncing || !selectedInstance || instances.length === 0}
              >
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sincronizar Grupos
              </Button>
            </div>
            {instances.length === 0 && (
              <p className="text-sm text-muted-foreground mt-3">
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-primary"
                  onClick={() => navigate("/dashboard/instances")}
                >
                  Conecte uma instância WhatsApp
                </Button>
                {" "}para sincronizar seus grupos.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar grupos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filtrar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                <SelectItem value="admin">Sou admin</SelectItem>
                <SelectItem value="active">Grupos ativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <Select value={instanceFilter} onValueChange={setInstanceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Instância..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas instâncias</SelectItem>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.nickname || inst.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant={isMultiSelectMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              if (isMultiSelectMode) {
                setSelectedGroups(new Set());
              }
            }}
          >
            {isMultiSelectMode ? <CheckSquare className="mr-2 h-4 w-4" /> : <Square className="mr-2 h-4 w-4" />}
            Seleção
          </Button>
          <Badge variant="secondary">
            {filteredGroups.length} grupo{filteredGroups.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Multi-select actions bar */}
        {isMultiSelectMode && (
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
            <Checkbox
              checked={selectedGroups.size === filteredGroups.length && filteredGroups.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm text-muted-foreground">
              {selectedGroups.size} selecionado{selectedGroups.size !== 1 ? "s" : ""}
            </span>
            {selectedGroups.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmDeleteSelected}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remover ({selectedGroups.size})
              </Button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 ? (
          <OnboardingCard
            variant="hero"
            icon={Users}
            title={instances.length > 0 ? "Sincronize seus grupos" : "Conecte uma instância primeiro"}
            description={
              instances.length > 0 
                ? "Clique em 'Sincronizar Grupos' acima para importar seus grupos do WhatsApp. Depois, ative os grupos que deseja usar no sistema."
                : "Para ver e gerenciar seus grupos, primeiro você precisa conectar uma instância WhatsApp."
            }
            steps={
              instances.length > 0
                ? [
                    { label: "Selecione a instância", isComplete: !!selectedInstance },
                    { label: "Clique em Sincronizar", isComplete: false },
                    { label: "Ative os grupos desejados", isComplete: false },
                  ]
                : [
                    { label: "Crie uma instância", isComplete: false },
                    { label: "Conecte via QR Code", isComplete: false },
                    { label: "Volte aqui para sincronizar", isComplete: false },
                  ]
            }
            actionLabel={instances.length === 0 ? "Ir para Instâncias" : undefined}
            onAction={instances.length === 0 ? () => navigate("/dashboard/instances") : undefined}
          />
        ) : filteredGroups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">Nenhum grupo encontrado</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {filteredGroups.map((group) => (
                  <div 
                    key={group.id} 
                    className={`flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors ${
                      selectedGroups.has(group.id) ? "bg-primary/5" : ""
                    }`}
                  >
                    {/* Multi-select checkbox */}
                    {isMultiSelectMode && (
                      <Checkbox
                        checked={selectedGroups.has(group.id)}
                        onCheckedChange={() => toggleGroupSelection(group.id)}
                        className="flex-shrink-0"
                      />
                    )}

                    {/* Group Photo */}
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarImage src={group.photo_url || undefined} alt={group.name} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {getGroupInitials(group.name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Group Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{group.name}</h3>
                        {group.is_user_admin && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Shield className="h-4 w-4 text-primary flex-shrink-0" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Você é administrador deste grupo e pode alterá-lo</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {group.is_active && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="default" className="text-xs cursor-help">Ativo</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Este grupo está disponível para uso em links e campanhas</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      {group.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {group.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        {/* Instance badges */}
                        {group.group_instances && group.group_instances.length > 0 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1">
                                  <Smartphone className="h-3 w-3 text-primary" />
                                  <span className="text-xs font-medium text-primary">
                                    {group.group_instances.length} instância{group.group_instances.length > 1 ? "s" : ""}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium mb-1">Instâncias conectadas:</p>
                                <ul className="text-xs space-y-1">
                                  {group.group_instances.map((gi) => (
                                    <li key={gi.instance_id} className="flex items-center gap-1">
                                      <span>{gi.whatsapp_instances?.nickname || gi.whatsapp_instances?.name}</span>
                                      {gi.is_admin && <Shield className="h-3 w-3 text-primary" />}
                                    </li>
                                  ))}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {group.whatsapp_instances?.name || "Sem instância"}
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className={`text-xs font-medium ${getParticipantColor(group.member_count)}`}>
                            {group.member_count}
                          </span>
                        </div>
                        {group.synced_at && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(group.synced_at).toLocaleDateString("pt-BR")}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {group.invite_link && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => copyInviteLink(group.invite_link!)}
                            title="Copiar link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <a 
                              href={group.invite_link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              title="Abrir link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      )}
                      <GroupHistory groupId={group.id} groupName={group.name} />
                      
                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => confirmDeleteGroup(group.id)}
                        title="Remover grupo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      
                      {/* Toggle Active */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 pl-2 border-l border-border">
                              <Switch
                                checked={group.is_active}
                                onCheckedChange={() => toggleGroupActive(group.id, group.is_active)}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{group.is_active ? "Clique para desativar" : "Clique para ativar"}</p>
                            <p className="text-xs text-muted-foreground">
                              {group.is_active 
                                ? "Grupo não aparecerá em links/campanhas" 
                                : "Grupo ficará disponível para uso"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover grupo(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                {groupToDelete 
                  ? "Este grupo será removido da sua lista. Você pode sincronizá-lo novamente a qualquer momento."
                  : `${selectedGroups.size} grupo(s) serão removidos da sua lista. Você pode sincronizá-los novamente a qualquer momento.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Admin Sync Confirmation Dialog */}
        <AlertDialog open={adminSyncConfirmOpen} onOpenChange={setAdminSyncConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sincronizar todos os grupos?</AlertDialogTitle>
              <AlertDialogDescription>
                Sincronizar todos os grupos (incluindo os que você não é admin) pode demorar significativamente mais tempo e consumir mais recursos.
                <br /><br />
                Deseja continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                setOnlyAdminSync(false);
                setAdminSyncConfirmOpen(false);
              }}>
                Sim, sincronizar todos
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
