import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2, Save, User, CreditCard, Shield, Crown, Smartphone, Users, Link, Megaphone, XCircle, AlertTriangle, Banknote } from "lucide-react";
import CheckoutModal from "@/components/payments/CheckoutModal";

interface Profile {
  full_name: string | null;
  email: string;
  phone: string | null;
}

export default function Settings() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const { subscription, limits, loading: subLoading, refetch: refetchSubscription } = useSubscription();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", effectiveUserId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setFormData({
          full_name: data.full_name || "",
          phone: data.phone || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
        })
        .eq("id", user!.id);

      if (error) throw error;

      await supabase.from("activity_logs").insert({
        user_id: user!.id,
        action: "update_profile",
        entity_type: "profile",
        entity_id: user!.id,
      });

      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);

    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription');

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        refetchSubscription();
      } else {
        throw new Error(data.error || 'Erro ao cancelar assinatura');
      }
    } catch (error: any) {
      console.error("Error cancelling subscription:", error);
      toast.error(error.message || "Erro ao cancelar assinatura");
    } finally {
      setCancelling(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getStatusLabel = (status: string | undefined) => {
    const labels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      trial: { label: "Período de Teste", variant: "outline" },
      active: { label: "Ativo", variant: "default" },
      payment_pending: { label: "Pagamento Pendente", variant: "secondary" },
      suspended: { label: "Suspenso", variant: "destructive" },
      cancelled: { label: "Cancelado", variant: "secondary" },
    };
    return labels[status || "trial"] || labels.trial;
  };

  const canCancel = subscription && 
    ['active', 'trial'].includes(subscription.status) && 
    subscription.plan.price > 0;

  const isPendingPayment = subscription?.status === 'payment_pending';

  const pendingPlan = subscription ? {
    id: subscription.plan.id,
    name: subscription.plan.name,
    price: subscription.plan.price,
    periodicity: subscription.plan.periodicity || 'monthly'
  } : null;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const statusInfo = getStatusLabel(subscription?.status);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie suas informações e preferências
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil
            </CardTitle>
            <CardDescription>
              Atualize suas informações pessoais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile?.email || user.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  O e-mail não pode ser alterado
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Seu nome completo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+55 11 99999-9999"
                />
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Assinatura
            </CardTitle>
            <CardDescription>
              Gerencie seu plano e pagamentos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {subLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : subscription ? (
              <>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Crown className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{subscription.plan.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {subscription.plan.description}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                </div>

                {/* Alert for pending payment */}
                {isPendingPayment && (
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-amber-500/20">
                          <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-amber-800 dark:text-amber-200">
                            Pagamento Pendente
                          </p>
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            Complete o pagamento para ativar seu plano
                          </p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setShowCheckoutModal(true)}
                        className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                      >
                        <Banknote className="mr-2 h-4 w-4" />
                        Pagar Agora
                      </Button>
                    </div>
                  </div>
                )}

                {limits && (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">Uso do Plano</p>
                    
                    {[
                      { key: "instances", label: "Instâncias", icon: Smartphone, ...limits.instances },
                      { key: "groups", label: "Grupos", icon: Users, ...limits.groups },
                      { key: "links", label: "Links", icon: Link, ...limits.links },
                      { key: "campaigns", label: "Campanhas/mês", icon: Megaphone, ...limits.campaigns },
                    ].map((item) => (
                      <div key={item.key} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <item.icon className="h-4 w-4 text-muted-foreground" />
                            <span>{item.label}</span>
                          </div>
                          <span className="font-medium">
                            {item.current}/{item.max ?? "∞"}
                          </span>
                        </div>
                        {item.max !== null && (
                          <Progress
                            value={Math.min((item.current / item.max) * 100, 100)}
                            className="h-2"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {subscription.expires_at && (
                  <p className="text-sm text-muted-foreground">
                    {subscription.status === "trial" ? "Trial expira" : 
                     subscription.status === "cancelled" ? "Acesso até" :
                     "Próxima renovação"}:{" "}
                    {new Date(subscription.expires_at).toLocaleDateString("pt-BR")}
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => navigate("/dashboard/plans")}>
                    {subscription.plan.price === 0 ? "Fazer Upgrade" : "Alterar Plano"}
                  </Button>

                  {canCancel && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancelar Assinatura
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Cancelar Assinatura
                          </AlertDialogTitle>
                          <AlertDialogDescription className="space-y-3">
                            <p>
                              Tem certeza que deseja cancelar sua assinatura do plano <strong>{subscription.plan.name}</strong>?
                            </p>
                            <ul className="text-sm space-y-1 list-disc list-inside">
                              <li>A cobrança recorrente será interrompida imediatamente</li>
                              <li>Você ainda terá acesso até o fim do período pago</li>
                              <li>Após isso, sua conta será limitada ao plano gratuito</li>
                            </ul>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Manter Assinatura</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleCancelSubscription}
                            disabled={cancelling}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {cancelling ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Cancelando...
                              </>
                            ) : (
                              "Sim, Cancelar"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                {subscription.status === 'cancelled' && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
                    <p className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Sua assinatura foi cancelada. Você ainda tem acesso até o fim do período pago.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Nenhuma assinatura encontrada</p>
                <Button className="mt-4" onClick={() => navigate("/dashboard/plans")}>
                  Ver Planos
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Segurança
            </CardTitle>
            <CardDescription>
              Configurações de segurança da conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full justify-start">
              Alterar Senha
            </Button>
            <Separator />
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleSignOut}
            >
              Sair da Conta
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Checkout Modal for pending payment */}
      <CheckoutModal
        open={showCheckoutModal}
        onOpenChange={setShowCheckoutModal}
        plan={pendingPlan}
        onSuccess={() => {
          refetchSubscription();
          setShowCheckoutModal(false);
        }}
      />
    </DashboardLayout>
  );
}
