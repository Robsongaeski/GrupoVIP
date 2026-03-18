import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, CreditCard, LogOut, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import CheckoutModal from "@/components/payments/CheckoutModal";

export default function PaymentRequiredOverlay() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { subscription, getDaysUntilSuspension, isSuspended, isTrialExpired, refetch } = useSubscription();
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const daysRemaining = getDaysUntilSuspension();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const pendingPlan = subscription ? {
    id: subscription.plan.id,
    name: subscription.plan.name,
    price: subscription.plan.price,
    periodicity: subscription.plan.periodicity || 'monthly'
  } : null;

  // Suspended account - most severe state
  if (isSuspended) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
        <Card className="w-full max-w-md shadow-2xl border-destructive/50">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 p-4 rounded-full bg-destructive/10">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-2xl text-destructive">Conta Suspensa</CardTitle>
            <CardDescription className="text-base">
              Sua conta foi suspensa por falta de pagamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                Suas instâncias WhatsApp foram desconectadas. 
                Regularize seu pagamento para reativar sua conta e reconectar suas instâncias.
              </p>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={() => setShowCheckoutModal(true)}
                className="w-full h-12 text-base"
                size="lg"
              >
                <CreditCard className="mr-2 h-5 w-5" />
                Regularizar Pagamento
              </Button>

              <Button 
                variant="outline" 
                onClick={handleSignOut}
                className="w-full"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair da Conta
              </Button>
            </div>
          </CardContent>
        </Card>

        <CheckoutModal
          open={showCheckoutModal}
          onOpenChange={setShowCheckoutModal}
          plan={pendingPlan}
          onSuccess={() => {
            refetch();
            setShowCheckoutModal(false);
          }}
        />
      </div>
    );
  }

  // Trial expired - encourage to subscribe
  if (isTrialExpired) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
        <Card className="w-full max-w-md shadow-2xl border-primary/50">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
              <Sparkles className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl text-primary">Período de Teste Finalizado</CardTitle>
            <CardDescription className="text-base">
              Seu período de teste gratuito chegou ao fim
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">
                Esperamos que você tenha gostado da experiência! 
                Para continuar utilizando todos os recursos, escolha um plano que melhor se adapta às suas necessidades.
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Plano recomendado:</span>
                <span className="font-medium">{subscription?.plan.name}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-muted-foreground">A partir de:</span>
                <span className="font-medium">
                  R$ {subscription?.plan.price.toFixed(2).replace('.', ',')}
                  <span className="text-xs text-muted-foreground">/{subscription?.plan.periodicity === 'monthly' ? 'mês' : 'ano'}</span>
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={() => setShowCheckoutModal(true)}
                className="w-full h-12 text-base"
                size="lg"
              >
                <ArrowRight className="mr-2 h-5 w-5" />
                Assinar Agora
              </Button>

              <Button 
                variant="outline" 
                onClick={() => navigate("/dashboard/plans")}
                className="w-full"
              >
                Ver Todos os Planos
              </Button>

              <Button 
                variant="ghost" 
                onClick={handleSignOut}
                className="w-full text-muted-foreground"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair da Conta
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Seus dados estão seguros. Assim que assinar, você terá acesso completo novamente.
            </p>
          </CardContent>
        </Card>

        <CheckoutModal
          open={showCheckoutModal}
          onOpenChange={setShowCheckoutModal}
          plan={pendingPlan}
          onSuccess={() => {
            refetch();
            setShowCheckoutModal(false);
          }}
        />
      </div>
    );
  }

  // Paid subscription expired - payment pending
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md shadow-2xl border-amber-500/50">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 p-4 rounded-full bg-amber-500/10">
            <Clock className="h-12 w-12 text-amber-600" />
          </div>
          <CardTitle className="text-2xl text-amber-600">Pagamento Pendente</CardTitle>
          <CardDescription className="text-base">
            Sua assinatura expirou e precisa ser renovada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {daysRemaining !== null && daysRemaining > 0 && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
              <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                {daysRemaining} {daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-500">
                para regularizar antes da suspensão
              </p>
            </div>
          )}

          {daysRemaining === 0 && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
              <p className="text-lg font-bold text-destructive">
                Último dia para pagar!
              </p>
              <p className="text-sm text-destructive/80">
                Sua conta será suspensa em breve
              </p>
            </div>
          )}

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Plano atual:</span>
              <span className="font-medium">{subscription?.plan.name}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-muted-foreground">Valor:</span>
              <span className="font-medium">
                R$ {subscription?.plan.price.toFixed(2).replace('.', ',')}
                <span className="text-xs text-muted-foreground">/{subscription?.plan.periodicity === 'monthly' ? 'mês' : 'ano'}</span>
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={() => setShowCheckoutModal(true)}
              className="w-full h-12 text-base bg-amber-600 hover:bg-amber-700"
              size="lg"
            >
              <CreditCard className="mr-2 h-5 w-5" />
              Renovar Assinatura
            </Button>

            <Button 
              variant="outline" 
              onClick={handleSignOut}
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair da Conta
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Após a suspensão, suas instâncias WhatsApp serão desconectadas 
            e você precisará reconectá-las após o pagamento.
          </p>
        </CardContent>
      </Card>

      <CheckoutModal
        open={showCheckoutModal}
        onOpenChange={setShowCheckoutModal}
        plan={pendingPlan}
        onSuccess={() => {
          refetch();
          setShowCheckoutModal(false);
        }}
      />
    </div>
  );
}
