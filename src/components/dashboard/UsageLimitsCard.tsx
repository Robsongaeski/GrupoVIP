import { useSubscription } from "@/hooks/useSubscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Smartphone, Users, Link, Megaphone, AlertTriangle, Crown } from "lucide-react";

export function UsageLimitsCard() {
  const { subscription, limits, loading, isSuspended, isTrialExpired } = useSubscription();
  const navigate = useNavigate();

  if (loading || !limits) return null;

  const getProgressValue = (current: number, max: number | null) => {
    if (max === null) return 0;
    return Math.min((current / max) * 100, 100);
  };

  const getProgressColor = (current: number, max: number | null) => {
    if (max === null) return "bg-primary";
    const percentage = (current / max) * 100;
    if (percentage >= 90) return "bg-destructive";
    if (percentage >= 70) return "bg-warning";
    return "bg-primary";
  };

  const limitItems = [
    { key: "instances", label: "Instâncias", icon: Smartphone, ...limits.instances },
    { key: "groups", label: "Grupos", icon: Users, ...limits.groups },
    { key: "links", label: "Links", icon: Link, ...limits.links },
    { key: "campaigns", label: "Campanhas/mês", icon: Megaphone, ...limits.campaigns },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Uso do Plano
            </CardTitle>
            <CardDescription>
              {subscription?.plan.name} - {subscription?.status === "trial" ? "Período de Teste" : "Ativo"}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/plans")}>
            Upgrade
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(isSuspended || isTrialExpired) && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {isSuspended
                ? "Sua conta está suspensa. Entre em contato com o suporte."
                : "Seu período de teste expirou. Faça upgrade para continuar."}
            </span>
          </div>
        )}

        {limitItems.map((item) => (
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
                value={getProgressValue(item.current, item.max)}
                className="h-2"
                indicatorClassName={getProgressColor(item.current, item.max)}
              />
            )}
            {item.max !== null && item.current >= item.max && (
              <Badge variant="destructive" className="text-xs">
                Limite atingido
              </Badge>
            )}
          </div>
        ))}

        {subscription?.expires_at && (
          <div className="pt-2 border-t text-sm text-muted-foreground">
            {subscription.status === "trial" ? "Trial expira" : "Renova"} em{" "}
            {new Date(subscription.expires_at).toLocaleDateString("pt-BR")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
