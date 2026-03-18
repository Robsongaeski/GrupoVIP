import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { Check, Loader2, Crown, Sparkles, Zap } from "lucide-react";
import CheckoutModal from "@/components/payments/CheckoutModal";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  periodicity: string;
  max_instances: number | null;
  max_groups: number | null;
  max_links: number | null;
  max_campaigns_month: number | null;
  features: string[];
}

export default function Plans() {
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading, refetch: refetchSubscription } = useSubscription();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Verificar status do pagamento na URL
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      toast.success("Pagamento processado! Sua assinatura será ativada em breve.");
      refetchSubscription();
      // Limpar parâmetros da URL
      navigate('/dashboard/plans', { replace: true });
    }
  }, [searchParams, navigate, refetchSubscription]);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) throw error;

      setPlans(
        (data || []).map((p) => ({
          ...p,
          features: Array.isArray(p.features) ? p.features as string[] : [],
        }))
      );
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast.error("Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: Plan) => {
    if (!user) {
      toast.error("Você precisa estar logado");
      navigate("/auth");
      return;
    }

    // Para planos pagos, abrir modal de checkout
    if (plan.price > 0) {
      setSelectedPlan(plan);
      setCheckoutOpen(true);
      return;
    }

    // Para planos gratuitos, processar diretamente
    setSubscribingPlanId(plan.id);

    try {
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: { plan_id: plan.id }
      });

      if (error) throw error;

      if (data.type === 'free') {
        toast.success(data.message);
        refetchSubscription();
      }
    } catch (error: any) {
      console.error("Error subscribing:", error);
      toast.error(error.message || "Erro ao processar assinatura");
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const handleCheckoutSuccess = () => {
    refetchSubscription();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getPlanIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("pro") || lowerName.includes("premium")) return Crown;
    if (lowerName.includes("business") || lowerName.includes("enterprise")) return Sparkles;
    return Zap;
  };

  const isCurrentPlan = (planId: string) => subscription?.plan?.id === planId;

  if (authLoading || subLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight">Escolha seu Plano</h1>
          <p className="text-muted-foreground mt-2">
            Selecione o plano ideal para suas necessidades
          </p>
        </div>

        {subscription && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Crown className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Plano Atual: {subscription.plan.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Status: {subscription.status === "trial" ? "Período de Teste" : 
                               subscription.status === "active" ? "Ativo" : 
                               subscription.status}
                    </p>
                  </div>
                </div>
                {subscription.expires_at && (
                  <Badge variant="outline">
                    Expira em {new Date(subscription.expires_at).toLocaleDateString("pt-BR")}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const Icon = getPlanIcon(plan.name);
            const isCurrent = isCurrentPlan(plan.id);
            const isPopular = plan.name.toLowerCase().includes("pro");

            return (
              <Card
                key={plan.id}
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                  isPopular ? "border-primary shadow-md" : ""
                } ${isCurrent ? "ring-2 ring-primary" : ""}`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-medium">
                    Mais Popular
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isPopular ? "bg-primary/10" : "bg-muted"}`}>
                      <Icon className={`h-5 w-5 ${isPopular ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {plan.name}
                        {isCurrent && <Badge variant="secondary">Atual</Badge>}
                      </CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <span className="text-4xl font-bold">{formatPrice(plan.price)}</span>
                    <span className="text-muted-foreground">/{plan.periodicity === "monthly" ? "mês" : "ano"}</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{plan.max_instances ?? "Ilimitadas"} instância(s)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{plan.max_groups ?? "Ilimitados"} grupos</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{plan.max_links ?? "Ilimitados"} links inteligentes</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{plan.max_campaigns_month ?? "Ilimitadas"} campanhas/mês</span>
                    </div>
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : isPopular ? "default" : "secondary"}
                    disabled={isCurrent || subscribingPlanId !== null}
                    onClick={() => handleSubscribe(plan)}
                  >
                    {subscribingPlanId === plan.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : isCurrent ? (
                      "Plano Atual"
                    ) : plan.price === 0 ? (
                      "Começar Grátis"
                    ) : (
                      "Assinar Agora"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Precisa de mais? Entre em contato para um plano personalizado.</p>
        </div>
      </div>

      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        plan={selectedPlan}
        onSuccess={handleCheckoutSuccess}
      />
    </DashboardLayout>
  );
}
