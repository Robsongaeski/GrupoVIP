import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OnboardingCard } from "@/components/ui/onboarding-card";
import { LinkCreationWizard } from "@/components/links/LinkCreationWizard";
import { DirectChatWizard } from "@/components/links/DirectChatWizard";
import { LinkTypeSelector, LinkType } from "@/components/links/LinkTypeSelector";
import { LinkDetailsDialog } from "@/components/links/LinkDetailsDialog";
import { OrphanedLinksAlert } from "@/components/links/OrphanedLinksAlert";
import { LinkRecoveryDialog } from "@/components/links/LinkRecoveryDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Link as LinkIcon,
  Plus,
  Copy,
  ExternalLink,
  BarChart3,
  Trash2,
  Loader2,
  MousePointer,
  Settings,
  Globe,
  Zap,
  Users,
  Calendar,
  Image,
  Edit,
  RefreshCw,
  Share2,
  Eye,
  MessageCircle,
} from "lucide-react";

interface IntelligentLink {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  mode: "connected" | "manual" | "direct_chat";
  status: "active" | "inactive" | "expired";
  default_message?: string | null;
  click_count: number;
  capacity_limit: number | null;
  expires_at: string | null;
  title: string | null;
  landing_description: string | null;
  logo_url: string | null;
  no_vacancy_message: string | null;
  redirect_url: string | null;
  created_at: string;
  pixel_id: string | null;
  facebook_pixel_id: string | null;
  facebook_pixel_event: string | null;
  link_groups?: { count: number }[];
  link_manual_groups?: { count: number }[];
  link_phone_numbers?: { count: number }[];
}

interface Group {
  id: string;
  name: string;
  member_count: number;
  max_members: number;
  invite_link: string | null;
  is_user_admin: boolean | null;
  whatsapp_id: string;
}

interface ManualGroup {
  id: string;
  link_id: string;
  internal_name: string;
  invite_url: string;
  click_limit: number;
  current_clicks: number;
  priority: number;
  is_active: boolean;
}

interface ManualGroupInput {
  internal_name: string;
  invite_url: string;
  click_limit: string;
}

interface UserPixel {
  id: string;
  name: string;
  pixel_id: string;
  is_default: boolean | null;
}

const MAX_WHATSAPP_MEMBERS = 1024;

export default function Links() {
  const { user, loading: authLoading } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const navigate = useNavigate();
  const [links, setLinks] = useState<IntelligentLink[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [userPixels, setUserPixels] = useState<UserPixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [linkTypeDialogOpen, setLinkTypeDialogOpen] = useState(false);
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType | null>(null);
  const [directChatWizardOpen, setDirectChatWizardOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);
  const [manualGroupsDialogOpen, setManualGroupsDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<IntelligentLink | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [manualGroups, setManualGroups] = useState<ManualGroup[]>([]);
  const [manualGroupsToAdd, setManualGroupsToAdd] = useState<ManualGroupInput[]>([]);
  const [phoneNumbersToAdd, setPhoneNumbersToAdd] = useState<{ internal_name: string; phone_number: string; display_name: string; is_active: boolean; }[]>([]);
  const [directChatFormData, setDirectChatFormData] = useState({
    name: "",
    slug: "",
    description: "",
    default_message: "",
    title: "",
    landing_description: "",
    logo_url: "",
    pixel_id: "",
    facebook_pixel_event: "PageView",
  });
  const [saving, setSaving] = useState(false);
  const [fetchingInvite, setFetchingInvite] = useState<string | null>(null);
  const [showEditValidationErrors, setShowEditValidationErrors] = useState(false);
  const [showManualGroupErrors, setShowManualGroupErrors] = useState(false);
  
  // Link recovery states
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState(false);
  const [recoveryLinkId, setRecoveryLinkId] = useState<string | undefined>();
  const [recoveryLinkName, setRecoveryLinkName] = useState<string | undefined>();
  const [recoverAll, setRecoverAll] = useState(false);
  const [orphanAlertRefresh, setOrphanAlertRefresh] = useState(0);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    mode: "connected" as "connected" | "manual" | "direct_chat",
    capacity_limit: "1000",
    title: "",
    landing_description: "",
    logo_url: "",
    no_vacancy_message: "Sem vagas no momento. Tente novamente mais tarde.",
    redirect_url: "",
    expires_at: "",
    pixel_id: "",
    facebook_pixel_event: "PageView",
  });

  const [newManualGroup, setNewManualGroup] = useState({
    internal_name: "",
    invite_url: "",
    click_limit: "1000",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchLinks();
      fetchGroups();
      fetchUserPixels();
    }
  }, [user, effectiveUserId]);

  const fetchUserPixels = async () => {
    try {
      const { data, error } = await supabase
        .from("user_pixels")
        .select("id, name, pixel_id, is_default")
        .eq("user_id", effectiveUserId)
        .order("is_default", { ascending: false });

      if (error) throw error;
      setUserPixels(data || []);
    } catch (error) {
      console.error("Error fetching user pixels:", error);
    }
  };

  const fetchLinks = async () => {
    try {
      const { data, error } = await supabase
        .from("intelligent_links")
        .select(`
          *,
          link_groups(count),
          link_manual_groups(count),
          link_phone_numbers(count)
        `)
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error("Error fetching links:", error);
      toast.error("Erro ao carregar links");
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, member_count, max_members, invite_link, is_user_admin, whatsapp_id")
        .eq("user_id", effectiveUserId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  const handleFetchInviteCode = async (group: Group) => {
    setFetchingInvite(group.id);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api", {
        body: {
          action: "fetch-invite-code",
          groupId: group.id,
          whatsappGroupId: group.whatsapp_id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGroups(prev => prev.map(g => 
        g.id === group.id ? { ...g, invite_link: data.invite_link, is_user_admin: true } : g
      ));
      
      toast.success("Link de convite obtido com sucesso!");
    } catch (error: any) {
      console.error("Error fetching invite code:", error);
      toast.error(error.message || "Erro ao buscar link de convite");
    } finally {
      setFetchingInvite(null);
    }
  };

  const fetchLinkGroups = async (linkId: string) => {
    try {
      const { data, error } = await supabase
        .from("link_groups")
        .select("group_id")
        .eq("link_id", linkId);

      if (error) throw error;
      setSelectedGroups(data?.map(lg => lg.group_id) || []);
    } catch (error) {
      console.error("Error fetching link groups:", error);
    }
  };

  const fetchManualGroups = async (linkId: string) => {
    try {
      const { data, error } = await supabase
        .from("link_manual_groups")
        .select("*")
        .eq("link_id", linkId)
        .order("priority");

      if (error) throw error;
      setManualGroups(data || []);
    } catch (error) {
      console.error("Error fetching manual groups:", error);
    }
  };

  const handleCreateLink = async () => {
    setSaving(true);

    try {
      // Create the link
      const { data: newLink, error: linkError } = await supabase
        .from("intelligent_links")
        .insert({
          user_id: user!.id,
          name: formData.name,
          slug: formData.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          description: formData.description || null,
          mode: formData.mode,
          capacity_limit: parseInt(formData.capacity_limit) || 1000,
          title: formData.title || null,
          landing_description: formData.landing_description || null,
          logo_url: formData.logo_url || null,
          no_vacancy_message: formData.no_vacancy_message || null,
          redirect_url: formData.redirect_url || null,
          expires_at: formData.expires_at || null,
          status: "active",
          pixel_id: formData.pixel_id || null,
          facebook_pixel_event: formData.facebook_pixel_event || "PageView",
        })
        .select()
        .single();

      if (linkError) throw linkError;

      // Save connected groups
      if (formData.mode === "connected" && selectedGroups.length > 0) {
        const linkGroups = selectedGroups.map((groupId, index) => ({
          link_id: newLink.id,
          group_id: groupId,
          priority: index,
          is_active: true,
        }));

        const { error: groupsError } = await supabase
          .from("link_groups")
          .insert(linkGroups);

        if (groupsError) throw groupsError;
      }

      // Save manual groups
      if (formData.mode === "manual" && manualGroupsToAdd.length > 0) {
        const manualGroupsData = manualGroupsToAdd.map((group, index) => ({
          link_id: newLink.id,
          internal_name: group.internal_name,
          invite_url: group.invite_url,
          click_limit: parseInt(group.click_limit) || 1000,
          priority: index,
        }));

        const { error: manualError } = await supabase
          .from("link_manual_groups")
          .insert(manualGroupsData);

        if (manualError) throw manualError;
      }

      toast.success("Link criado com sucesso!");
      setWizardOpen(false);
      resetForm();
      fetchLinks();
    } catch (error: any) {
      console.error("Error creating link:", error);
      if (error.code === "23505") {
        toast.error("Já existe um link com esse slug");
      } else {
        toast.error("Erro ao criar link");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLink) return;
    
    if (!formData.name.trim()) {
      setShowEditValidationErrors(true);
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    
    setSaving(true);

    try {
      const { error } = await supabase
        .from("intelligent_links")
        .update({
          name: formData.name,
          description: formData.description || null,
          mode: formData.mode,
          capacity_limit: parseInt(formData.capacity_limit) || 1000,
          title: formData.title || null,
          landing_description: formData.landing_description || null,
          logo_url: formData.logo_url || null,
          no_vacancy_message: formData.no_vacancy_message || null,
          redirect_url: formData.redirect_url || null,
          expires_at: formData.expires_at || null,
          pixel_id: formData.pixel_id || null,
          facebook_pixel_event: formData.facebook_pixel_event || "PageView",
        })
        .eq("id", selectedLink.id);

      if (error) throw error;

      toast.success("Link atualizado com sucesso!");
      setEditDialogOpen(false);
      fetchLinks();
    } catch (error) {
      console.error("Error updating link:", error);
      toast.error("Erro ao atualizar link");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      mode: "connected",
      capacity_limit: "1000",
      title: "",
      landing_description: "",
      logo_url: "",
      no_vacancy_message: "Sem vagas no momento. Tente novamente mais tarde.",
      redirect_url: "",
      expires_at: "",
      pixel_id: "",
      facebook_pixel_event: "PageView",
    });
    setSelectedGroups([]);
    setManualGroupsToAdd([]);
    setPhoneNumbersToAdd([]);
    setDirectChatFormData({
      name: "",
      slug: "",
      description: "",
      default_message: "",
      title: "",
      landing_description: "",
      logo_url: "",
      pixel_id: "",
      facebook_pixel_event: "PageView",
    });
    setShowEditValidationErrors(false);
    setSelectedLinkType(null);
  };

  const handleOpenWizard = () => {
    resetForm();
    setLinkTypeDialogOpen(true);
  };

  const handleSelectLinkType = (type: LinkType) => {
    setSelectedLinkType(type);
    setLinkTypeDialogOpen(false);
    if (type === "groups") {
      setWizardOpen(true);
    } else {
      setDirectChatWizardOpen(true);
    }
  };

  const handleCreateDirectChatLink = async () => {
    setSaving(true);

    try {
      // Create the link
      const { data: newLink, error: linkError } = await supabase
        .from("intelligent_links")
        .insert({
          user_id: user!.id,
          name: directChatFormData.name,
          slug: directChatFormData.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          description: directChatFormData.description || null,
          mode: "direct_chat" as const,
          default_message: directChatFormData.default_message || null,
          title: directChatFormData.title || null,
          landing_description: directChatFormData.landing_description || null,
          logo_url: directChatFormData.logo_url || null,
          status: "active",
          pixel_id: directChatFormData.pixel_id || null,
          facebook_pixel_event: directChatFormData.facebook_pixel_event || "PageView",
        })
        .select()
        .single();

      if (linkError) throw linkError;

      // Save phone numbers
      if (phoneNumbersToAdd.length > 0) {
        const phoneData = phoneNumbersToAdd.map((phone, index) => ({
          link_id: newLink.id,
          internal_name: phone.internal_name,
          phone_number: phone.phone_number,
          display_name: phone.display_name || null,
          is_active: phone.is_active,
          priority: index,
        }));

        const { error: phoneError } = await supabase
          .from("link_phone_numbers")
          .insert(phoneData);

        if (phoneError) throw phoneError;
      }

      toast.success("Link de conversa direta criado com sucesso!");
      setDirectChatWizardOpen(false);
      resetForm();
      fetchLinks();
    } catch (error: any) {
      console.error("Error creating direct chat link:", error);
      if (error.code === "23505") {
        toast.error("Já existe um link com esse slug");
      } else {
        toast.error("Erro ao criar link");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditDialog = (link: IntelligentLink) => {
    setSelectedLink(link);
    setFormData({
      name: link.name,
      slug: link.slug,
      description: link.description || "",
      mode: link.mode,
      capacity_limit: String(link.capacity_limit || 1000),
      title: link.title || "",
      landing_description: link.landing_description || "",
      logo_url: link.logo_url || "",
      no_vacancy_message: link.no_vacancy_message || "",
      redirect_url: link.redirect_url || "",
      expires_at: link.expires_at ? link.expires_at.split("T")[0] : "",
      pixel_id: link.pixel_id || "",
      facebook_pixel_event: link.facebook_pixel_event || "PageView",
    });
    setEditDialogOpen(true);
  };

  const handleOpenGroupsDialog = async (link: IntelligentLink) => {
    setSelectedLink(link);
    await fetchLinkGroups(link.id);
    setGroupsDialogOpen(true);
  };

  const handleOpenManualGroupsDialog = async (link: IntelligentLink) => {
    setSelectedLink(link);
    await fetchManualGroups(link.id);
    setManualGroupsDialogOpen(true);
  };

  const handleSaveGroups = async () => {
    if (!selectedLink) return;
    setSaving(true);

    try {
      await supabase
        .from("link_groups")
        .delete()
        .eq("link_id", selectedLink.id);

      if (selectedGroups.length > 0) {
        const linkGroups = selectedGroups.map((groupId, index) => ({
          link_id: selectedLink.id,
          group_id: groupId,
          priority: index,
          is_active: true,
        }));

        const { error } = await supabase
          .from("link_groups")
          .insert(linkGroups);

        if (error) throw error;
      }

      toast.success("Grupos atualizados com sucesso!");
      setGroupsDialogOpen(false);
    } catch (error) {
      console.error("Error saving groups:", error);
      toast.error("Erro ao salvar grupos");
    } finally {
      setSaving(false);
    }
  };

  const handleAddManualGroup = async () => {
    if (!selectedLink || !newManualGroup.internal_name.trim() || !newManualGroup.invite_url.trim()) {
      setShowManualGroupErrors(true);
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);

    try {
      const { error } = await supabase.from("link_manual_groups").insert({
        link_id: selectedLink.id,
        internal_name: newManualGroup.internal_name,
        invite_url: newManualGroup.invite_url,
        click_limit: parseInt(newManualGroup.click_limit) || 1000,
        priority: manualGroups.length,
      });

      if (error) throw error;

      toast.success("Grupo adicionado!");
      setNewManualGroup({ internal_name: "", invite_url: "", click_limit: "1000" });
      setShowManualGroupErrors(false);
      await fetchManualGroups(selectedLink.id);
    } catch (error) {
      console.error("Error adding manual group:", error);
      toast.error("Erro ao adicionar grupo");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteManualGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from("link_manual_groups")
        .delete()
        .eq("id", groupId);

      if (error) throw error;

      toast.success("Grupo removido!");
      setManualGroups(prev => prev.filter(g => g.id !== groupId));
    } catch (error) {
      console.error("Error deleting manual group:", error);
      toast.error("Erro ao remover grupo");
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleToggleLinkStatus = async (link: IntelligentLink) => {
    try {
      const newStatus = link.status === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("intelligent_links")
        .update({ status: newStatus })
        .eq("id", link.id);

      if (error) throw error;

      toast.success(`Link ${newStatus === "active" ? "ativado" : "desativado"}!`);
      fetchLinks();
    } catch (error) {
      console.error("Error toggling link status:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este link?")) return;

    try {
      // First delete related records to avoid FK issues
      await supabase.from("link_groups").delete().eq("link_id", id);
      await supabase.from("link_manual_groups").delete().eq("link_id", id);
      await supabase.from("link_clicks").delete().eq("link_id", id);

      // Then delete the link itself
      const { error, count } = await supabase
        .from("intelligent_links")
        .delete()
        .eq("id", id)
        .select();

      if (error) throw error;
      
      // Verify something was actually deleted
      if (count === 0) {
        throw new Error("Nenhum link encontrado para excluir");
      }

      toast.success("Link excluído com sucesso!");
      setLinks(prev => prev.filter(link => link.id !== id));
    } catch (error: any) {
      console.error("Error deleting link:", error);
      toast.error(error.message || "Erro ao excluir link");
    }
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/go/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const getStatusBadge = (status: IntelligentLink["status"]) => {
    const config = {
      active: { label: "Ativo", variant: "default" as const },
      inactive: { label: "Inativo", variant: "secondary" as const },
      expired: { label: "Expirado", variant: "destructive" as const },
    };
    return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
  };

  const getModeBadge = (mode: IntelligentLink["mode"]) => {
    const config = {
      connected: { label: "Conectado", icon: Zap, className: "bg-primary/10 text-primary" },
      manual: { label: "Manual", icon: Globe, className: "bg-warning/10 text-warning" },
      direct_chat: { label: "Conversa", icon: MessageCircle, className: "bg-chart-3/10 text-chart-3" },
    };
    const { label, icon: Icon, className } = config[mode];
    return (
      <Badge variant="outline" className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
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
        {/* Orphaned Links Alert */}
        <OrphanedLinksAlert
          refreshTrigger={orphanAlertRefresh}
          onRecoverClick={(linkId, linkName) => {
            setRecoveryLinkId(linkId);
            setRecoveryLinkName(linkName);
            setRecoverAll(false);
            setRecoveryDialogOpen(true);
          }}
          onRecoverAll={() => {
            setRecoveryLinkId(undefined);
            setRecoveryLinkName(undefined);
            setRecoverAll(true);
            setRecoveryDialogOpen(true);
          }}
        />

        {/* Link Recovery Dialog */}
        <LinkRecoveryDialog
          open={recoveryDialogOpen}
          onOpenChange={setRecoveryDialogOpen}
          linkId={recoveryLinkId}
          linkName={recoveryLinkName}
          recoverAll={recoverAll}
          onRecovered={() => {
            setOrphanAlertRefresh(prev => prev + 1);
            fetchLinks();
          }}
        />

        {/* Onboarding Card */}
        {links.length === 0 && !loading && (
          <OnboardingCard
            variant="hero"
            icon={Share2}
            title="O que são Links Inteligentes?"
            description="Links que distribuem automaticamente visitantes entre seus grupos de WhatsApp. Quando alguém clica no link, é direcionado para o grupo com mais vagas disponíveis."
            steps={[
              { label: "Crie o link", isComplete: false },
              { label: "Configure os grupos", isComplete: false },
              { label: "Compartilhe", isComplete: false },
            ]}
            actionLabel="Criar meu primeiro link"
            onAction={handleOpenWizard}
          />
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Links Inteligentes</h1>
            <p className="text-muted-foreground">
              Crie links que distribuem membros automaticamente entre seus grupos
            </p>
          </div>
          {links.length > 0 && (
            <Button onClick={handleOpenWizard}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Link
            </Button>
          )}
        </div>

        {/* Link Type Selection Dialog */}
        <Dialog open={linkTypeDialogOpen} onOpenChange={setLinkTypeDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Novo Link</DialogTitle>
              <DialogDescription>
                Escolha o tipo de link que você deseja criar
              </DialogDescription>
            </DialogHeader>
            <LinkTypeSelector onSelect={handleSelectLinkType} />
          </DialogContent>
        </Dialog>

        {/* Group Link Creation Wizard Dialog */}
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Link para Grupos</DialogTitle>
              <DialogDescription>
                Siga os passos para criar e configurar seu link de distribuição
              </DialogDescription>
            </DialogHeader>
            <LinkCreationWizard
              formData={formData}
              setFormData={setFormData}
              groups={groups}
              selectedGroups={selectedGroups}
              setSelectedGroups={setSelectedGroups}
              manualGroupsToAdd={manualGroupsToAdd}
              setManualGroupsToAdd={setManualGroupsToAdd}
              userPixels={userPixels}
              onSubmit={handleCreateLink}
              onCancel={() => setWizardOpen(false)}
              saving={saving}
              fetchingInvite={fetchingInvite}
              onFetchInviteCode={handleFetchInviteCode}
            />
          </DialogContent>
        </Dialog>

        {/* Direct Chat Creation Wizard Dialog */}
        <Dialog open={directChatWizardOpen} onOpenChange={setDirectChatWizardOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Link de Conversa Direta</DialogTitle>
              <DialogDescription>
                Configure um link que abre uma conversa no WhatsApp
              </DialogDescription>
            </DialogHeader>
            <DirectChatWizard
              formData={directChatFormData}
              setFormData={setDirectChatFormData}
              phoneNumbers={phoneNumbersToAdd}
              setPhoneNumbers={setPhoneNumbersToAdd}
              userPixels={userPixels}
              onSubmit={handleCreateDirectChatLink}
              onCancel={() => setDirectChatWizardOpen(false)}
              saving={saving}
            />
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleUpdateLink}>
              <DialogHeader>
                <DialogTitle>Editar Link</DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="basic" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Básico</TabsTrigger>
                  <TabsTrigger value="landing">Landing Page</TabsTrigger>
                  <TabsTrigger value="advanced">Avançado</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      Nome do Link <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={showEditValidationErrors && !formData.name.trim() ? "border-destructive" : ""}
                      required
                    />
                    {showEditValidationErrors && !formData.name.trim() && (
                      <p className="text-sm text-destructive">O nome do link é obrigatório</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input value={formData.slug} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground">O slug não pode ser alterado</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Modo de Operação</Label>
                    <Select
                      value={formData.mode}
                      onValueChange={(v: "connected" | "manual") => setFormData({ ...formData, mode: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="connected">Conectado</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="landing" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={formData.landing_description}
                      onChange={(e) => setFormData({ ...formData, landing_description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL do Logo</Label>
                    <Input
                      value={formData.logo_url}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem Sem Vagas</Label>
                    <Textarea
                      value={formData.no_vacancy_message}
                      onChange={(e) => setFormData({ ...formData, no_vacancy_message: e.target.value })}
                      rows={2}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Limite de Membros</Label>
                    <Input
                      type="number"
                      value={formData.capacity_limit}
                      onChange={(e) => setFormData({ ...formData, capacity_limit: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL de Fallback</Label>
                    <Input
                      value={formData.redirect_url}
                      onChange={(e) => setFormData({ ...formData, redirect_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Expiração</Label>
                    <Input
                      type="date"
                      value={formData.expires_at}
                      onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    />
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        <h4 className="font-medium">Facebook Pixel</h4>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/dashboard/settings/pixel")}
                        className="text-primary hover:text-primary"
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Configurar Pixel
                      </Button>
                    </div>
                    
                    {userPixels.length === 0 ? (
                      <p className="text-sm text-muted-foreground mb-4">
                        Nenhum pixel cadastrado. <span className="font-medium text-foreground cursor-pointer hover:underline" onClick={() => navigate("/dashboard/settings/pixel")}>Cadastre um pixel</span> para habilitar o rastreamento.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Pixel a Usar</Label>
                          <Select
                            value={formData.pixel_id || "none"}
                            onValueChange={(value) => setFormData({ ...formData, pixel_id: value === "none" ? "" : value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um pixel" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum pixel</SelectItem>
                              {userPixels.map((pixel) => (
                                <SelectItem key={pixel.id} value={pixel.id}>
                                  {pixel.name} ({pixel.pixel_id}){pixel.is_default ? " - Padrão" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Escolha qual pixel será usado para rastrear este link
                          </p>
                        </div>
                        
                        {formData.pixel_id && (
                          <div className="space-y-2">
                            <Label>Evento a Disparar</Label>
                            <Select
                              value={formData.facebook_pixel_event || "PageView"}
                              onValueChange={(value) => setFormData({ ...formData, facebook_pixel_event: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PageView">PageView</SelectItem>
                                <SelectItem value="Lead">Lead</SelectItem>
                                <SelectItem value="CompleteRegistration">CompleteRegistration</SelectItem>
                                <SelectItem value="Contact">Contact</SelectItem>
                                <SelectItem value="InitiateCheckout">InitiateCheckout</SelectItem>
                                <SelectItem value="Subscribe">Subscribe</SelectItem>
                                <SelectItem value="ViewContent">ViewContent</SelectItem>
                                <SelectItem value="AddToCart">AddToCart</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Connected Groups Dialog */}
        <Dialog open={groupsDialogOpen} onOpenChange={setGroupsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Configurar Grupos para Distribuição</DialogTitle>
              <DialogDescription>
                Selecione os grupos que receberão membros. O sistema distribuirá automaticamente com base na ocupação.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 max-h-[400px] overflow-y-auto space-y-2">
              {groups.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-2">
                    Nenhum grupo ativo encontrado
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ative grupos na página de Grupos
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-sm text-muted-foreground">
                      {selectedGroups.length} de {groups.filter(g => g.invite_link).length} grupos disponíveis
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const groupsWithLink = groups.filter(g => g.invite_link).map(g => g.id);
                        setSelectedGroups(selectedGroups.length === groupsWithLink.length ? [] : groupsWithLink);
                      }}
                    >
                      {selectedGroups.length === groups.filter(g => g.invite_link).length ? "Desmarcar todos" : "Selecionar todos"}
                    </Button>
                  </div>
                  {groups.map((group) => {
                    const occupancy = (group.member_count / MAX_WHATSAPP_MEMBERS) * 100;
                    const isFull = group.member_count >= MAX_WHATSAPP_MEMBERS;
                    const isNearFull = occupancy >= 80;
                    const hasInviteLink = !!group.invite_link;
                    const isDisabled = !hasInviteLink || isFull;
                    
                    return (
                      <div
                        key={group.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors ${
                          selectedGroups.includes(group.id) ? "border-primary bg-primary/5" : ""
                        } ${isDisabled ? "opacity-60" : ""}`}
                        onClick={() => !isDisabled && toggleGroup(group.id)}
                      >
                        <Checkbox
                          checked={selectedGroups.includes(group.id)}
                          onCheckedChange={() => !isDisabled && toggleGroup(group.id)}
                          disabled={isDisabled}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{group.name}</p>
                            {!hasInviteLink && (
                              <Button
                                size="sm"
                                className="h-7 px-3 text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 shadow-md border-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFetchInviteCode(group);
                                }}
                                disabled={fetchingInvite === group.id}
                              >
                                {fetchingInvite === group.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                )}
                                Buscar Link do Grupo
                              </Button>
                            )}
                            {hasInviteLink && isFull && (
                              <Badge variant="destructive" className="text-xs">Cheio</Badge>
                            )}
                            {hasInviteLink && !isFull && isNearFull && (
                              <Badge variant="secondary" className="text-xs bg-warning/10 text-warning">Quase cheio</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${
                                  isFull ? "bg-destructive" : isNearFull ? "bg-primary" : "bg-primary"
                                }`}
                                style={{ width: `${Math.min(occupancy, 100)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${
                              isFull ? "text-destructive" : "text-muted-foreground"
                            }`}>
                              {group.member_count}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {groups.filter(g => !g.invite_link).length > 0 && (
                    <div className="p-3 bg-warning/10 rounded-lg text-sm border border-warning/20">
                      <p className="text-warning text-xs">
                        <strong>Dica:</strong> Grupos sem link de convite precisam ter o convite gerado pelo WhatsApp. 
                        Você precisa ser admin do grupo. Sincronize novamente após gerar o link.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            {selectedGroups.length > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  <Zap className="h-4 w-4 inline mr-1 text-primary" />
                  O sistema distribuirá automaticamente os visitantes para os grupos com mais vagas disponíveis.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setGroupsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveGroups} disabled={saving || selectedGroups.length === 0}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar ({selectedGroups.length} grupos)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Groups Dialog */}
        <Dialog open={manualGroupsDialogOpen} onOpenChange={setManualGroupsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Gerenciar Grupos Manuais</DialogTitle>
              <DialogDescription>
                Adicione links de convite externos para distribuição
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Nome interno"
                    value={newManualGroup.internal_name}
                    onChange={(e) => setNewManualGroup({ ...newManualGroup, internal_name: e.target.value })}
                  />
                  <Input
                    placeholder="Limite de cliques"
                    type="number"
                    value={newManualGroup.click_limit}
                    onChange={(e) => setNewManualGroup({ ...newManualGroup, click_limit: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://chat.whatsapp.com/..."
                    value={newManualGroup.invite_url}
                    onChange={(e) => setNewManualGroup({ ...newManualGroup, invite_url: e.target.value })}
                    className="flex-1"
                  />
                  <Button onClick={handleAddManualGroup} disabled={saving}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {manualGroups.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum grupo manual adicionado
                  </p>
                ) : (
                  manualGroups.map((group, index) => (
                    <div key={group.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{group.internal_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.current_clicks}/{group.click_limit} cliques
                        </p>
                      </div>
                      <Badge variant={group.is_active ? "default" : "secondary"}>
                        #{index + 1}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDeleteManualGroup(group.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setManualGroupsDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Link Details Dialog */}
        <LinkDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          link={selectedLink}
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : links.length === 0 ? null : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {links.map((link) => (
              <Card key={link.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg truncate">{link.name}</CardTitle>
                      <CardDescription className="font-mono text-xs">
                        /go/{link.slug}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {getStatusBadge(link.status)}
                      {getModeBadge(link.mode)}
                      {(() => {
                        const groupsCount = link.link_groups?.[0]?.count || 0;
                        const manualCount = link.link_manual_groups?.[0]?.count || 0;
                        const phoneCount = link.link_phone_numbers?.[0]?.count || 0;
                        const totalTargets = groupsCount + manualCount + phoneCount;
                        
                        if (totalTargets === 0 && !link.redirect_url) {
                          return (
                            <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600 animate-pulse">
                              Sem Destinos
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {link.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {link.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <MousePointer className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{link.click_count}</p>
                      <p className="text-xs text-muted-foreground">cliques</p>
                    </div>
                    {link.expires_at && (
                      <div className="ml-auto text-right">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Expira
                        </p>
                        <p className="text-xs font-medium">
                          {new Date(link.expires_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => copyLink(link.slug)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedLink(link);
                        setDetailsDialogOpen(true);
                      }}
                      title="Ver detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditDialog(link)}
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => 
                        link.mode === "connected" 
                          ? handleOpenGroupsDialog(link) 
                          : handleOpenManualGroupsDialog(link)
                      }
                      title="Gerenciar grupos"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteLink(link.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Criado em {new Date(link.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    <Switch
                      checked={link.status === "active"}
                      onCheckedChange={() => handleToggleLinkStatus(link)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
