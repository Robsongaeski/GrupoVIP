import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  Smartphone,
  Users,
  MessageSquare,
  Link as LinkIcon,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  RefreshCw,
  DollarSign,
  Activity,
  Edit,
  UserX,
  UserCheck,
  Plus,
  Save,
} from "lucide-react";

interface ClientDetails {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  cpf_cnpj: string | null;
  created_at: string;
  subscription_status: string | null;
  suspended_at: string | null;
  subscription_expires_at: string | null;
  subscription_started_at: string | null;
  timezone: string | null;
}

interface Subscription {
  id: string;
  plan_id: string;
  plan_name: string;
  plan_price: number;
  status: string;
  periodicity: string;
  started_at: string;
  expires_at: string | null;
  external_subscription_id: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  external_payment_id: string;
  external_subscription_id: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  payment_type: string | null;
  payer_email: string | null;
  paid_at: string | null;
  created_at: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
}

interface Stats {
  instances_count: number;
  groups_count: number;
  campaigns_count: number;
  campaigns_sent: number;
  links_count: number;
  total_clicks: number;
  total_paid: number;
}

export default function AdminClientDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Dialogs
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editSubOpen, setEditSubOpen] = useState(false);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  
  // Edit client form
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCpfCnpj, setEditCpfCnpj] = useState("");
  
  // Edit subscription form
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [trialDays, setTrialDays] = useState(0);
  
  // Add payment form
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("manual");
  const [paymentNote, setPaymentNote] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchClientDetails();
      fetchPlans();
    }
  }, [user, id]);

  const fetchPlans = async () => {
    try {
      const { data } = await supabase
        .from("plans")
        .select("id, name, price")
        .eq("is_active", true)
        .order("price", { ascending: true });
      setPlans(data || []);
    } catch (error) {
      console.error("Error fetching plans:", error);
    }
  };

  const fetchClientDetails = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (profileError) throw profileError;
      setClient(profile);

      const [
        subscriptionsRes,
        paymentsRes,
        instancesRes,
        groupsRes,
        campaignsRes,
        campaignsSentRes,
        linksRes,
        clicksRes,
      ] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("*, plans(name, price)")
          .eq("user_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select("*")
          .eq("user_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("whatsapp_instances").select("id", { count: "exact", head: true }).eq("user_id", id),
        supabase.from("groups").select("id", { count: "exact", head: true }).eq("user_id", id),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("user_id", id),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("user_id", id).eq("status", "completed"),
        supabase.from("intelligent_links").select("id", { count: "exact", head: true }).eq("user_id", id),
        supabase.from("intelligent_links").select("click_count").eq("user_id", id),
      ]);

      const subs = (subscriptionsRes.data || []).map((s: any) => ({
        id: s.id,
        plan_id: s.plan_id,
        plan_name: s.plans?.name || "Desconhecido",
        plan_price: s.plans?.price || 0,
        status: s.status,
        periodicity: s.periodicity,
        started_at: s.started_at,
        expires_at: s.expires_at,
        external_subscription_id: s.external_subscription_id,
        created_at: s.created_at,
      }));
      setSubscriptions(subs);
      setPayments(paymentsRes.data || []);

      const totalClicks = (clicksRes.data || []).reduce((sum: number, l: any) => sum + (l.click_count || 0), 0);
      const totalPaid = (paymentsRes.data || [])
        .filter((p: any) => p.status === "approved")
        .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

      setStats({
        instances_count: instancesRes.count || 0,
        groups_count: groupsRes.count || 0,
        campaigns_count: campaignsRes.count || 0,
        campaigns_sent: campaignsSentRes.count || 0,
        links_count: linksRes.count || 0,
        total_clicks: totalClicks,
        total_paid: totalPaid,
      });
    } catch (error) {
      console.error("Error fetching client details:", error);
      toast.error("Erro ao carregar detalhes do cliente");
    } finally {
      setLoading(false);
    }
  };

  const openEditClient = () => {
    if (!client) return;
    setEditName(client.full_name || "");
    setEditPhone(client.phone || "");
    setEditCpfCnpj(client.cpf_cnpj || "");
    setEditClientOpen(true);
  };

  const handleUpdateClient = async () => {
    if (!client) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editName || null,
          phone: editPhone || null,
          cpf_cnpj: editCpfCnpj || null,
        })
        .eq("id", client.id);

      if (error) throw error;

      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "update_client_profile",
        target_type: "user",
        target_id: client.id,
        details: { email: client.email, changes: { full_name: editName, phone: editPhone } },
      });

      toast.success("Dados do cliente atualizados!");
      setEditClientOpen(false);
      fetchClientDetails();
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error("Erro ao atualizar cliente");
    } finally {
      setActionLoading(false);
    }
  };

  const openEditSubscription = () => {
    const currentSub = subscriptions[0];
    setSelectedPlanId(currentSub?.plan_id || "");
    setSelectedStatus(currentSub?.status || client?.subscription_status || "trial");
    const currentExpires = currentSub?.expires_at || client?.subscription_expires_at;
    setExpiresAt(currentExpires ? new Date(currentExpires).toISOString().split('T')[0] : "");
    setTrialDays(0);
    setEditSubOpen(true);
  };

  const handleUpdateSubscription = async () => {
    if (!client) return;
    setActionLoading(true);
    try {
      let newExpiresAt: string | null = null;
      if (expiresAt) {
        newExpiresAt = new Date(expiresAt + "T23:59:59").toISOString();
      } else if (trialDays > 0) {
        newExpiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
      } else {
        newExpiresAt = subscriptions[0]?.expires_at || null;
      }

      const currentSub = subscriptions[0];
      
      if (currentSub) {
        const updateData: any = {
          status: selectedStatus as any,
          expires_at: newExpiresAt,
          suspended_at: selectedStatus === "suspended" ? new Date().toISOString() : null,
        };
        if (selectedPlanId) updateData.plan_id = selectedPlanId;
        
        const { error } = await supabase
          .from("subscriptions")
          .update(updateData)
          .eq("id", currentSub.id);
        if (error) throw error;
      } else if (selectedPlanId) {
        const { error } = await supabase.from("subscriptions").insert({
          user_id: client.id,
          plan_id: selectedPlanId,
          status: selectedStatus as any,
          started_at: new Date().toISOString(),
          expires_at: newExpiresAt,
        });
        if (error) throw error;
      }

      await supabase
        .from("profiles")
        .update({
          subscription_status: selectedStatus as any,
          subscription_expires_at: newExpiresAt,
          suspended_at: selectedStatus === "suspended" ? new Date().toISOString() : null,
        })
        .eq("id", client.id);

      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "update_subscription",
        target_type: "user",
        target_id: client.id,
        details: { email: client.email, plan_id: selectedPlanId, status: selectedStatus },
      });

      toast.success("Assinatura atualizada!");
      setEditSubOpen(false);
      fetchClientDetails();
    } catch (error) {
      console.error("Error updating subscription:", error);
      toast.error("Erro ao atualizar assinatura");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (!client || !paymentAmount) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("payments").insert({
        user_id: client.id,
        external_payment_id: `MANUAL-${Date.now()}`,
        amount: parseFloat(paymentAmount),
        status: "approved",
        payment_method: paymentMethod,
        payment_type: "manual",
        payer_email: client.email,
        paid_at: new Date().toISOString(),
      });

      if (error) throw error;

      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "add_manual_payment",
        target_type: "user",
        target_id: client.id,
        details: { email: client.email, amount: paymentAmount, note: paymentNote },
      });

      toast.success("Pagamento registrado!");
      setAddPaymentOpen(false);
      setPaymentAmount("");
      setPaymentNote("");
      fetchClientDetails();
    } catch (error) {
      console.error("Error adding payment:", error);
      toast.error("Erro ao registrar pagamento");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendClient = async () => {
    if (!client) return;
    setActionLoading(true);
    try {
      if (stats && stats.instances_count > 0) {
        await supabase.functions.invoke("evolution-api", {
          body: { action: "delete-by-user", userId: client.id },
        });
      }

      await supabase
        .from("profiles")
        .update({
          subscription_status: "suspended",
          suspended_at: new Date().toISOString(),
        })
        .eq("id", client.id);

      if (subscriptions[0]) {
        await supabase
          .from("subscriptions")
          .update({ status: "suspended", suspended_at: new Date().toISOString() })
          .eq("id", subscriptions[0].id);
      }

      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "suspend_client",
        target_type: "user",
        target_id: client.id,
        details: { email: client.email },
      });

      toast.success("Cliente suspenso!");
      setSuspendDialogOpen(false);
      fetchClientDetails();
    } catch (error) {
      console.error("Error suspending client:", error);
      toast.error("Erro ao suspender cliente");
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateClient = async () => {
    if (!client) return;
    setActionLoading(true);
    try {
      await supabase
        .from("profiles")
        .update({
          subscription_status: "active",
          suspended_at: null,
        })
        .eq("id", client.id);

      if (subscriptions[0]) {
        await supabase
          .from("subscriptions")
          .update({ status: "active", suspended_at: null })
          .eq("id", subscriptions[0].id);
      }

      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "activate_client",
        target_type: "user",
        target_id: client.id,
        details: { email: client.email },
      });

      toast.success("Cliente ativado!");
      fetchClientDetails();
    } catch (error) {
      console.error("Error activating client:", error);
      toast.error("Erro ao ativar cliente");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTrialDays = async (days: number) => {
    if (!client) return;
    setActionLoading(true);
    try {
      const currentExpires = subscriptions[0]?.expires_at || client.subscription_expires_at;
      const baseDate = currentExpires ? new Date(currentExpires) : new Date();
      const newExpiresAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

      if (subscriptions[0]) {
        await supabase
          .from("subscriptions")
          .update({ expires_at: newExpiresAt })
          .eq("id", subscriptions[0].id);
      }

      await supabase
        .from("profiles")
        .update({ subscription_expires_at: newExpiresAt })
        .eq("id", client.id);

      await supabase.from("admin_audit_logs").insert({
        admin_id: user!.id,
        action: "add_trial_days",
        target_type: "user",
        target_id: client.id,
        details: { email: client.email, days_added: days },
      });

      toast.success(`${days} dias adicionados!`);
      fetchClientDetails();
    } catch (error) {
      console.error("Error adding trial days:", error);
      toast.error("Erro ao adicionar dias");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      trial: { label: "Trial", variant: "outline", icon: <Clock className="h-3 w-3" /> },
      active: { label: "Ativo", variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
      payment_pending: { label: "Pagamento Pendente", variant: "secondary", icon: <AlertCircle className="h-3 w-3" /> },
      suspended: { label: "Suspenso", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
      cancelled: { label: "Cancelado", variant: "secondary", icon: <XCircle className="h-3 w-3" /> },
    };
    const cfg = config[status || "trial"] || config.trial;
    return (
      <Badge variant={cfg.variant} className="gap-1">
        {cfg.icon}
        {cfg.label}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      approved: { label: "Aprovado", variant: "default" },
      pending: { label: "Pendente", variant: "secondary" },
      rejected: { label: "Rejeitado", variant: "destructive" },
      cancelled: { label: "Cancelado", variant: "outline" },
      refunded: { label: "Reembolsado", variant: "outline" },
    };
    const cfg = config[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const formatDateShort = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const getPaymentMethodLabel = (method: string | null, type: string | null) => {
    if (type === "manual") return "Manual (Admin)";
    if (type === "pix") return "PIX";
    if (type === "subscription" || type === "credit_card") return "Cartão de Crédito";
    if (method === "pix") return "PIX";
    return method || type || "-";
  };

  if (authLoading || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!client) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cliente não encontrado</p>
          <Button asChild className="mt-4">
            <Link to="/admin/clients">Voltar para Clientes</Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const currentSubscription = subscriptions[0];
  const isSuspended = client.subscription_status === "suspended" || currentSubscription?.status === "suspended";

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin/clients">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {client.full_name || "Cliente"}
              </h1>
              <p className="text-muted-foreground">{client.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchClientDetails} disabled={actionLoading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            {getStatusBadge(client.subscription_status)}
          </div>
        </div>

        {/* Action Buttons */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={openEditClient}>
                <Edit className="h-4 w-4 mr-2" />
                Editar Dados
              </Button>
              <Button variant="outline" size="sm" onClick={openEditSubscription}>
                <CreditCard className="h-4 w-4 mr-2" />
                Editar Assinatura
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAddPaymentOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Pagamento
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddTrialDays(7)} disabled={actionLoading}>
                <Calendar className="h-4 w-4 mr-2" />
                +7 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddTrialDays(30)} disabled={actionLoading}>
                <Calendar className="h-4 w-4 mr-2" />
                +30 dias
              </Button>
              <div className="flex-1" />
              {isSuspended ? (
                <Button variant="default" size="sm" onClick={handleActivateClient} disabled={actionLoading}>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Ativar Cliente
                </Button>
              ) : (
                <Button variant="destructive" size="sm" onClick={() => setSuspendDialogOpen(true)} disabled={actionLoading}>
                  <UserX className="h-4 w-4 mr-2" />
                  Suspender Cliente
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats?.total_paid || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {payments.filter(p => p.status === "approved").length} pagamentos aprovados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recursos Ativos</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.instances_count || 0}</div>
              <p className="text-xs text-muted-foreground">instâncias WhatsApp</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Campanhas</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.campaigns_sent || 0}</div>
              <p className="text-xs text-muted-foreground">de {stats?.campaigns_count || 0} criadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cliques nos Links</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_clicks || 0}</div>
              <p className="text-xs text-muted-foreground">em {stats?.links_count || 0} links</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Client Info */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{client.email}</p>
                  </div>
                </div>

                {client.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">{client.phone}</p>
                    </div>
                  </div>
                )}

                {client.cpf_cnpj && (
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">CPF/CNPJ</p>
                      <p className="font-medium">{client.cpf_cnpj}</p>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente desde</p>
                    <p className="font-medium">{formatDate(client.created_at)}</p>
                  </div>
                </div>

                {client.subscription_started_at && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Assinatura iniciada</p>
                      <p className="font-medium">{formatDate(client.subscription_started_at)}</p>
                    </div>
                  </div>
                )}

                {client.subscription_expires_at && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Expira em</p>
                      <p className="font-medium">{formatDate(client.subscription_expires_at)}</p>
                    </div>
                  </div>
                )}

                {client.suspended_at && (
                  <div className="flex items-center gap-3">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <div>
                      <p className="text-sm text-muted-foreground">Suspenso em</p>
                      <p className="font-medium text-destructive">{formatDate(client.suspended_at)}</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-2">Uso de Recursos</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span>{stats?.instances_count || 0} instâncias</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{stats?.groups_count || 0} grupos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>{stats?.campaigns_count || 0} campanhas</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{stats?.links_count || 0} links</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscriptions & Payments */}
          <div className="md:col-span-2 space-y-6">
            {/* Current Subscription */}
            {currentSubscription && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Assinatura Atual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-semibold text-lg">{currentSubscription.plan_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(currentSubscription.plan_price)}/{currentSubscription.periodicity === "yearly" ? "ano" : "mês"}
                      </p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(currentSubscription.status)}
                      {currentSubscription.expires_at && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Expira: {formatDateShort(currentSubscription.expires_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  {currentSubscription.external_subscription_id && (
                    <p className="text-xs text-muted-foreground mt-2">
                      ID Mercado Pago: {currentSubscription.external_subscription_id}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Payment History */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Histórico de Pagamentos
                    </CardTitle>
                    <CardDescription>
                      Todos os pagamentos realizados por este cliente
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setAddPaymentOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum pagamento registrado
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>ID Transação</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{formatDateShort(payment.created_at)}</p>
                                {payment.paid_at && (
                                  <p className="text-xs text-muted-foreground">
                                    Pago: {formatDate(payment.paid_at)}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={payment.status === "approved" ? "text-green-600 font-semibold" : ""}>
                                {formatCurrency(payment.amount)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {getPaymentMethodLabel(payment.payment_method, payment.payment_type)}
                            </TableCell>
                            <TableCell>
                              {getPaymentStatusBadge(payment.status)}
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {payment.external_payment_id.substring(0, 12)}...
                              </code>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedPayment(payment)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subscription History */}
            {subscriptions.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Assinaturas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Plano</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Iniciou</TableHead>
                          <TableHead>Expirou</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subscriptions.map((sub) => (
                          <TableRow key={sub.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{sub.plan_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(sub.plan_price)}/{sub.periodicity === "yearly" ? "ano" : "mês"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(sub.status)}</TableCell>
                            <TableCell>{formatDateShort(sub.started_at)}</TableCell>
                            <TableCell>{formatDateShort(sub.expires_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Edit Client Dialog */}
        <Dialog open={editClientOpen} onOpenChange={setEditClientOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Dados do Cliente</DialogTitle>
              <DialogDescription>Atualize as informações do cliente</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ</Label>
                <Input value={editCpfCnpj} onChange={(e) => setEditCpfCnpj(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditClientOpen(false)}>Cancelar</Button>
              <Button onClick={handleUpdateClient} disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Subscription Dialog */}
        <Dialog open={editSubOpen} onOpenChange={setEditSubOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Assinatura</DialogTitle>
              <DialogDescription>Altere o plano, status ou data de expiração</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - {formatCurrency(plan.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
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
              <div className="space-y-2">
                <Label>Data de Expiração</Label>
                <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ou adicionar dias a partir de hoje</Label>
                <Select value={trialDays.toString()} onValueChange={(v) => setTrialDays(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Não adicionar</SelectItem>
                    <SelectItem value="7">+7 dias</SelectItem>
                    <SelectItem value="15">+15 dias</SelectItem>
                    <SelectItem value="30">+30 dias</SelectItem>
                    <SelectItem value="60">+60 dias</SelectItem>
                    <SelectItem value="90">+90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSubOpen(false)}>Cancelar</Button>
              <Button onClick={handleUpdateSubscription} disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Payment Dialog */}
        <Dialog open={addPaymentOpen} onOpenChange={setAddPaymentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Pagamento Manual</DialogTitle>
              <DialogDescription>Registre um pagamento feito fora do sistema</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(e.target.value)} 
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Método de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Registro Manual</SelectItem>
                    <SelectItem value="pix_manual">PIX (fora do sistema)</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Input 
                  value={paymentNote} 
                  onChange={(e) => setPaymentNote(e.target.value)} 
                  placeholder="Ex: Pagamento referente ao mês de janeiro"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPaymentOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddPayment} disabled={actionLoading || !paymentAmount}>
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Registrar Pagamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Suspend Confirmation Dialog */}
        <AlertDialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Suspender Cliente</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja suspender este cliente? As instâncias WhatsApp serão desconectadas e removidas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleSuspendClient} className="bg-destructive text-destructive-foreground">
                {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Suspender
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Payment Details Dialog */}
        <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Pagamento</DialogTitle>
              <DialogDescription>
                ID: {selectedPayment?.external_payment_id}
              </DialogDescription>
            </DialogHeader>
            {selectedPayment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Valor</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(selectedPayment.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="mt-1">
                      {getPaymentStatusBadge(selectedPayment.status)}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Método</p>
                    <p className="font-medium">
                      {getPaymentMethodLabel(selectedPayment.payment_method, selectedPayment.payment_type)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Moeda</p>
                    <p className="font-medium">{selectedPayment.currency || "BRL"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Criado em</p>
                    <p className="font-medium">{formatDate(selectedPayment.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pago em</p>
                    <p className="font-medium">{formatDate(selectedPayment.paid_at)}</p>
                  </div>
                </div>

                {selectedPayment.payer_email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email do Pagador</p>
                    <p className="font-medium">{selectedPayment.payer_email}</p>
                  </div>
                )}

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground">ID da Transação</p>
                  <code className="block mt-1 p-2 bg-muted rounded text-sm break-all">
                    {selectedPayment.external_payment_id}
                  </code>
                </div>

                {selectedPayment.external_subscription_id && (
                  <div>
                    <p className="text-sm text-muted-foreground">ID da Assinatura (Mercado Pago)</p>
                    <code className="block mt-1 p-2 bg-muted rounded text-sm break-all">
                      {selectedPayment.external_subscription_id}
                    </code>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
