import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  User,
  Eye,
  Users,
  Smartphone,
  MessageSquare,
  Link as LinkIcon,
  Calendar,
  CreditCard,
  RefreshCw,
  LogIn,
  DollarSign,
} from "lucide-react";

interface Client {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  subscription_status: string | null;
  suspended_at: string | null;
  subscription_expires_at: string | null;
  phone: string | null;
  cpf_cnpj: string | null;
  // Stats
  instances_count: number;
  groups_count: number;
  campaigns_count: number;
  links_count: number;
  // Subscription info
  subscription?: {
    id: string;
    plan_id: string;
    plan_name: string;
    status: string;
    expires_at: string | null;
    started_at: string;
  } | null;
}

interface Plan {
  id: string;
  name: string;
  price: number;
}

export default function AdminClients() {
  const { user, loading: authLoading } = useAuth();
  const { startImpersonation } = useImpersonation();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Edit subscription dialog
  const [editSubOpen, setEditSubOpen] = useState(false);
  const [editSubClient, setEditSubClient] = useState<Client | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [trialDays, setTrialDays] = useState<number>(0);

  // Edit profile dialog
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfilePhone, setEditProfilePhone] = useState("");
  const [editProfileCpfCnpj, setEditProfileCpfCnpj] = useState("");

  // Add payment dialog
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("manual");
  const [paymentNote, setPaymentNote] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchClients();
      fetchPlans();
    }
  }, [user]);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, price")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error("Error fetching plans:", error);
    }
  };

  const fetchClients = async () => {
    try {
      // Fetch profiles with subscription info
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at, subscription_status, suspended_at, subscription_expires_at, phone, cpf_cnpj")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch subscriptions and stats for each client
      const clientsWithStats = await Promise.all(
        (profiles || []).map(async (profile) => {
          const [instancesRes, groupsRes, campaignsRes, linksRes, subscriptionRes] = await Promise.all([
            supabase.from("whatsapp_instances").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            supabase.from("groups").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            supabase.from("intelligent_links").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            supabase
              .from("subscriptions")
              .select("id, plan_id, status, expires_at, started_at, plans(name)")
              .eq("user_id", profile.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          const subscription = subscriptionRes.data
            ? {
                id: subscriptionRes.data.id,
                plan_id: subscriptionRes.data.plan_id,
                plan_name: (subscriptionRes.data.plans as any)?.name || "Desconhecido",
                status: subscriptionRes.data.status,
                expires_at: subscriptionRes.data.expires_at,
                started_at: subscriptionRes.data.started_at,
              }
            : null;

          return {
            ...profile,
            instances_count: instancesRes.count || 0,
            groups_count: groupsRes.count || 0,
            campaigns_count: campaignsRes.count || 0,
            links_count: linksRes.count || 0,
            subscription,
          };
        })
      );

      setClients(clientsWithStats);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const deleteUserInstancesFromEvolution = async (userId: string) => {
    try {
      console.log(`Removing Evolution API instances for user ${userId}`);
      const response = await supabase.functions.invoke("evolution-api", {
        body: { action: "delete-by-user", userId },
      });

      if (response.error) {
        console.error("Error removing instances from Evolution API:", response.error);
        return { success: false, error: response.error.message };
      }

      console.log("Evolution API instances removal result:", response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error("Error calling evolution-api:", error);
      return { success: false, error: (error as Error).message };
    }
  };

  const handleSuspendClient = async (client: Client) => {
    if (!confirm(`Tem certeza que deseja suspender ${client.email}? As instâncias WhatsApp serão desconectadas.`)) return;

    setActionLoading(client.id);
    try {
      // First, remove instances from Evolution API
      if (client.instances_count > 0) {
        const evolutionResult = await deleteUserInstancesFromEvolution(client.id);
        if (evolutionResult.success) {
          console.log(`Removed ${evolutionResult.data?.count || 0} instances from Evolution API`);
        } else {
          console.warn("Failed to remove some instances from Evolution API:", evolutionResult.error);
        }
      }

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          subscription_status: "suspended",
          suspended_at: new Date().toISOString(),
        })
        .eq("id", client.id);

      if (profileError) throw profileError;

      // Update subscription if exists
      if (client.subscription) {
        await supabase
          .from("subscriptions")
          .update({ status: "suspended", suspended_at: new Date().toISOString() })
          .eq("id", client.subscription.id);
      }

      // Log action
      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "suspend_client",
        target_type: "user",
        target_id: client.id,
        details: { email: client.email, instances_removed: client.instances_count },
      });

      toast.success("Cliente suspenso e instâncias removidas com sucesso!");
      fetchClients();
    } catch (error) {
      console.error("Error suspending client:", error);
      toast.error("Erro ao suspender cliente");
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivateClient = async (client: Client) => {
    setActionLoading(client.id);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          subscription_status: "active",
          suspended_at: null,
        })
        .eq("id", client.id);

      if (profileError) throw profileError;

      // Update subscription if exists
      if (client.subscription) {
        await supabase
          .from("subscriptions")
          .update({ status: "active", suspended_at: null })
          .eq("id", client.subscription.id);
      }

      // Log action
      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "activate_client",
        target_type: "user",
        target_id: client.id,
        details: { email: client.email },
      });

      toast.success("Cliente ativado com sucesso!");
      fetchClients();
    } catch (error) {
      console.error("Error activating client:", error);
      toast.error("Erro ao ativar cliente");
    } finally {
      setActionLoading(null);
    }
  };

  const openEditSubscription = (client: Client) => {
    setEditSubClient(client);
    setSelectedPlanId(client.subscription?.plan_id || "");
    setSelectedStatus(client.subscription?.status || client.subscription_status || "trial");
    // Format date for input
    const currentExpires = client.subscription?.expires_at || client.subscription_expires_at;
    setExpiresAt(currentExpires ? new Date(currentExpires).toISOString().split('T')[0] : "");
    setTrialDays(0);
    setEditSubOpen(true);
  };

  const handleUpdateSubscription = async () => {
    if (!editSubClient) return;

    setActionLoading(editSubClient.id);
    try {
      // Calculate expiration date: manual date takes priority, then trial days, then existing
      let newExpiresAt: string | null = null;
      if (expiresAt) {
        // Set to end of day in local timezone
        newExpiresAt = new Date(expiresAt + "T23:59:59").toISOString();
      } else if (trialDays > 0) {
        newExpiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
      } else {
        newExpiresAt = editSubClient.subscription?.expires_at || null;
      }

      // Validate that a plan is selected for new subscriptions
      if (!editSubClient.subscription && !selectedPlanId) {
        toast.error("Selecione um plano para cadastrar o usuário");
        setActionLoading(null);
        return;
      }

      // Update or create subscription
      if (editSubClient.subscription) {
        const updateData: any = {
          status: selectedStatus as any,
          expires_at: newExpiresAt,
          suspended_at: selectedStatus === "suspended" ? new Date().toISOString() : null,
        };
        // Only update plan_id if one is selected
        if (selectedPlanId) {
          updateData.plan_id = selectedPlanId;
        }
        
        const { error } = await supabase
          .from("subscriptions")
          .update(updateData)
          .eq("id", editSubClient.subscription.id);

        if (error) throw error;
      } else if (selectedPlanId) {
        const { error } = await supabase.from("subscriptions").insert({
          user_id: editSubClient.id,
          plan_id: selectedPlanId,
          status: selectedStatus as any,
          started_at: new Date().toISOString(),
          expires_at: newExpiresAt,
        });

        if (error) throw error;
      }

      // Update profile status
      await supabase
        .from("profiles")
        .update({
          subscription_status: selectedStatus as any,
          subscription_expires_at: newExpiresAt,
          suspended_at: selectedStatus === "suspended" ? new Date().toISOString() : null,
        })
        .eq("id", editSubClient.id);

      // Log action
      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "update_subscription",
        target_type: "user",
        target_id: editSubClient.id,
        details: {
          email: editSubClient.email,
          plan_id: selectedPlanId,
          status: selectedStatus,
          trial_days_added: trialDays,
        },
      });

      toast.success("Assinatura atualizada com sucesso!");
      setEditSubOpen(false);
      fetchClients();
    } catch (error) {
      console.error("Error updating subscription:", error);
      toast.error("Erro ao atualizar assinatura");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddTrialDays = async (client: Client, days: number) => {
    setActionLoading(client.id);
    try {
      const currentExpires = client.subscription?.expires_at || client.subscription_expires_at;
      const baseDate = currentExpires ? new Date(currentExpires) : new Date();
      const newExpiresAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

      // Update subscription
      if (client.subscription) {
        await supabase
          .from("subscriptions")
          .update({ expires_at: newExpiresAt })
          .eq("id", client.subscription.id);
      }

      // Update profile
      await supabase
        .from("profiles")
        .update({ subscription_expires_at: newExpiresAt })
        .eq("id", client.id);

      // Log action
      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "add_trial_days",
        target_type: "user",
        target_id: client.id,
        details: { email: client.email, days_added: days },
      });

      toast.success(`${days} dias adicionados com sucesso!`);
      fetchClients();
    } catch (error) {
      console.error("Error adding trial days:", error);
      toast.error("Erro ao adicionar dias");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAsPaid = async (client: Client) => {
    setActionLoading(client.id);
    try {
      // Set expiration to 30 days from now
      const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Update subscription
      if (client.subscription) {
        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            expires_at: newExpiresAt,
            payment_failed_at: null,
          })
          .eq("id", client.subscription.id);
      }

      // Update profile
      await supabase
        .from("profiles")
        .update({
          subscription_status: "active",
          subscription_expires_at: newExpiresAt,
          payment_failed_at: null,
          suspended_at: null,
        })
        .eq("id", client.id);

      // Log action
      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "mark_as_paid",
        target_type: "user",
        target_id: client.id,
        details: { email: client.email, quick_action: true },
      });

      toast.success("Pagamento de 30 dias registrado com sucesso!");
      fetchClients();
    } catch (error) {
      console.error("Error marking as paid:", error);
      toast.error("Erro ao registrar pagamento");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateProfile = async () => {
    if (!selectedClient) return;
    setActionLoading(selectedClient.id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editProfileName || null,
          phone: editProfilePhone || null,
          cpf_cnpj: editProfileCpfCnpj || null,
        })
        .eq("id", selectedClient.id);

      if (error) throw error;

      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "update_client_profile",
        target_type: "user",
        target_id: selectedClient.id,
        details: { email: selectedClient.email, changes: { full_name: editProfileName } },
      });

      toast.success("Perfil atualizado com sucesso!");
      setEditProfileOpen(false);
      fetchClients();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLaunchPayment = async () => {
    if (!selectedClient || !paymentAmount) return;
    setActionLoading(selectedClient.id);
    try {
      const amount = parseFloat(paymentAmount);
      const { error } = await supabase.from("payments").insert({
        user_id: selectedClient.id,
        external_payment_id: `MANUAL-${Date.now()}`,
        amount,
        status: "approved",
        payment_method: paymentMethod,
        payment_type: "manual",
        payer_email: selectedClient.email,
        paid_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Log action
      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "add_manual_payment",
        target_type: "user",
        target_id: selectedClient.id,
        details: { email: selectedClient.email, amount, method: paymentMethod, note: paymentNote },
      });

      toast.success("Pagamento manual registrado!");
      setAddPaymentOpen(false);
      setPaymentAmount("");
      setPaymentNote("");
      fetchClients();
    } catch (error) {
      console.error("Error launching payment:", error);
      toast.error("Erro ao lançar pagamento");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      trial: { label: "Trial", variant: "outline" },
      active: { label: "Ativo", variant: "default" },
      payment_pending: { label: "Pagamento Pendente", variant: "secondary" },
      suspended: { label: "Suspenso", variant: "destructive" },
      cancelled: { label: "Cancelado", variant: "secondary" },
    };
    const cfg = config[status || "trial"] || config.trial;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const filteredClients = clients.filter(
    (client) =>
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
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
            <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
            <p className="text-muted-foreground">
              Gerencie os clientes do sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchClients()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {clients.length} clientes
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por email ou nome..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-center">Instâncias</TableHead>
                      <TableHead className="text-center">Grupos</TableHead>
                      <TableHead className="text-center">Campanhas</TableHead>
                      <TableHead className="text-center">Links</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => (
                      <TableRow 
                        key={client.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/admin/clients/${client.id}`)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{client.full_name || "Sem nome"}</p>
                            <p className="text-sm text-muted-foreground">{client.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(client.subscription?.status || client.subscription_status)}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {client.subscription?.plan_name || "Sem plano"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "text-sm font-medium",
                            (client.subscription?.expires_at || client.subscription_expires_at) && 
                            new Date(client.subscription?.expires_at || client.subscription_expires_at!) < new Date() 
                              ? "text-destructive" 
                              : "text-muted-foreground"
                          )}>
                            {client.subscription?.expires_at || client.subscription_expires_at
                              ? new Date(client.subscription?.expires_at || client.subscription_expires_at!).toLocaleDateString("pt-BR")
                              : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Smartphone className="h-4 w-4 text-muted-foreground" />
                            {client.instances_count}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {client.groups_count}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            {client.campaigns_count}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <LinkIcon className="h-4 w-4 text-muted-foreground" />
                            {client.links_count}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={actionLoading === client.id}>
                                {actionLoading === client.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Ações Rápidas</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                startImpersonation({
                                  id: client.id,
                                  email: client.email,
                                  fullName: client.full_name,
                                });
                                navigate("/dashboard");
                              }}>
                                <LogIn className="mr-2 h-4 w-4" />
                                Acessar como cliente
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                setSelectedClient(client);
                                setEditProfileName(client.full_name || "");
                                setEditProfilePhone(client.phone || "");
                                setEditProfileCpfCnpj(client.cpf_cnpj || "");
                                setEditProfileOpen(true);
                              }}>
                                <User className="mr-2 h-4 w-4" />
                                Editar Cadastro
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditSubscription(client)}>
                                <CreditCard className="mr-2 h-4 w-4" />
                                Editar Plano / Vencimento
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedClient(client);
                                setPaymentAmount("");
                                setPaymentNote("");
                                setAddPaymentOpen(true);
                              }}>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Lançar Pagamento
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAddTrialDays(client, 7)}>
                                <Calendar className="mr-2 h-4 w-4" />
                                +7 dias de teste
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAddTrialDays(client, 30)}>
                                <Calendar className="mr-2 h-4 w-4" />
                                +30 dias de teste
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {client.subscription_status === "suspended" || client.subscription?.status === "suspended" ? (
                                <DropdownMenuItem onClick={() => handleActivateClient(client)}>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Ativar Cliente
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => handleSuspendClient(client)}
                                  className="text-destructive"
                                >
                                  <UserX className="mr-2 h-4 w-4" />
                                  Suspender Cliente
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Client Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Cliente</DialogTitle>
              <DialogDescription>
                Informações completas do cliente
              </DialogDescription>
            </DialogHeader>
            {selectedClient && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{selectedClient.full_name || "Não informado"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedClient.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedClient.subscription?.status || selectedClient.subscription_status)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cadastro</p>
                    <p className="font-medium">
                      {new Date(selectedClient.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Plano</p>
                    <p className="font-medium">{selectedClient.subscription?.plan_name || "Sem plano"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expira em</p>
                    <p className="font-medium">
                      {selectedClient.subscription?.expires_at || selectedClient.subscription_expires_at
                        ? new Date(selectedClient.subscription?.expires_at || selectedClient.subscription_expires_at!).toLocaleDateString("pt-BR")
                        : "N/A"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Métricas</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{selectedClient.instances_count}</p>
                      <p className="text-xs text-muted-foreground">Instâncias</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{selectedClient.groups_count}</p>
                      <p className="text-xs text-muted-foreground">Grupos</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{selectedClient.campaigns_count}</p>
                      <p className="text-xs text-muted-foreground">Campanhas</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{selectedClient.links_count}</p>
                      <p className="text-xs text-muted-foreground">Links</p>
                    </div>
                  </div>
                </div>

                {selectedClient.suspended_at && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    Suspenso em {new Date(selectedClient.suspended_at).toLocaleString("pt-BR")}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Subscription Dialog */}
        <Dialog open={editSubOpen} onOpenChange={setEditSubOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editSubClient?.subscription ? "Editar Assinatura" : "Cadastrar Assinatura"}
              </DialogTitle>
              <DialogDescription>
                {editSubClient?.email}
              </DialogDescription>
            </DialogHeader>
            {editSubClient && (
              <div className="space-y-4">
                {!editSubClient.subscription && (
                  <div className="p-3 rounded-lg bg-muted border border-dashed">
                    <p className="text-sm text-muted-foreground">
                      Este usuário ainda não possui um plano. Selecione um plano e defina a data de vencimento para cadastrar.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>
                    Plano {!editSubClient.subscription && <span className="text-destructive">*</span>}
                  </Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} - R$ {plan.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="payment_pending">Pagamento Pendente</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Data de Vencimento</Label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => {
                      setExpiresAt(e.target.value);
                      setTrialDays(0); // Clear trial days when manual date is set
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Data em que a assinatura/fatura expira
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Ou adicionar dias a partir de hoje</Label>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                        setExpiresAt(date.toISOString().split('T')[0]);
                      }}
                    >
                      +7 dias
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const date = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
                        setExpiresAt(date.toISOString().split('T')[0]);
                      }}
                    >
                      +15 dias
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                        setExpiresAt(date.toISOString().split('T')[0]);
                      }}
                    >
                      +30 dias
                    </Button>
                  </div>
                </div>

                {expiresAt && (
                  <div className="p-3 rounded-lg bg-primary/10 text-sm">
                    <p>
                      <strong>Nova data de vencimento:</strong>{" "}
                      {new Date(expiresAt + "T12:00:00").toLocaleDateString("pt-BR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSubOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateSubscription} 
                disabled={actionLoading === editSubClient?.id}
              >
                {actionLoading === editSubClient?.id && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editSubClient?.subscription ? "Salvar Alterações" : "Cadastrar Assinatura"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Profile Dialog */}
        <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Cadastro</DialogTitle>
              <DialogDescription>
                {selectedClient?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome Completo</Label>
                <Input
                  id="edit-name"
                  value={editProfileName}
                  onChange={(e) => setEditProfileName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input
                  id="edit-phone"
                  value={editProfilePhone}
                  onChange={(e) => setEditProfilePhone(e.target.value)}
                  placeholder="Ex: 5511999999999"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cpf">CPF / CNPJ</Label>
                <Input
                  id="edit-cpf"
                  value={editProfileCpfCnpj}
                  onChange={(e) => setEditProfileCpfCnpj(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditProfileOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateProfile} disabled={actionLoading === selectedClient?.id}>
                {actionLoading === selectedClient?.id && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Payment Dialog */}
        <Dialog open={addPaymentOpen} onOpenChange={setAddPaymentOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Lançar Pagamento Manual</DialogTitle>
              <DialogDescription>
                Registre um pagamento recebido por fora do sistema para {selectedClient?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Valor (R$)</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a forma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Dinheiro / Manual</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="bank_transfer">Transferência</SelectItem>
                    <SelectItem value="credit_card">Cartão (Manual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-note">Observação</Label>
                <Input
                  id="payment-note"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Opcional: Ex: Pago via WhatsApp"
                />
              </div>
              <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground italic">
                Nota: Lançar um pagamento aqui registra a transação financeira, mas NÃO altera automaticamente a validade do plano. Para alterar a validade, use "Editar Plano / Vencimento".
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPaymentOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleLaunchPayment} disabled={actionLoading === selectedClient?.id || !paymentAmount}>
                {actionLoading === selectedClient?.id && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Confirmar Pagamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
