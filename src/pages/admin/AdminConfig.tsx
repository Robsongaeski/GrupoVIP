import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Server, Eye, EyeOff, RefreshCw, CreditCard, AlertTriangle, MessageSquare } from "lucide-react";

interface SystemConfig {
  key: string;
  value: string;
  description: string;
  is_secret: boolean;
}

export default function AdminConfig() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingUazapi, setTestingUazapi] = useState(false);
  const [providerChanged, setProviderChanged] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchConfigs();
    }
  }, [user]);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from("system_config")
        .select("key, value, description, is_secret")
        .order("key");

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error("Error fetching configs:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = (key: string, value: string) => {
    setConfigs(prev => 
      prev.map(config => 
        config.key === key ? { ...config, value } : config
      )
    );
  };

  const handleSave = async () => {
    if (providerChanged) {
      if (!window.confirm("Atenção: Mudar o provedor de WhatsApp ativo é uma ação global e desconectará todas as instâncias existentes dos clientes. Eles precisarão ler o QR Code novamente. Deseja realmente realizar essa troca?")) {
        return;
      }
    }

    setSaving(true);
    try {
      const providerConfig = configs.find(c => c.key === "whatsapp_provider");
      
      if (providerChanged && providerConfig) {
        // Chama a RPC para garantir que mude as configs e derrube as instâncias numa transação segura
        const { error: rpcError } = await supabase.rpc("admin_toggle_whatsapp_provider", {
          p_new_provider: providerConfig.value
        });
        if (rpcError) throw rpcError;
      }

      for (const config of configs) {
        // Se já chamou RPC para provider, pula ele na atualização individual
        if (providerChanged && config.key === "whatsapp_provider") continue;

        const { error } = await supabase
          .from("system_config")
          .update({ value: config.value })
          .eq("key", config.key);

        if (error) throw error;
      }

      setProviderChanged(false);
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Error saving configs:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const provider = getConfigValue("whatsapp_provider") || "evolution";
    
    if (provider === "evolution") {
      const apiUrl = getConfigValue("evolution_api_url");
      const apiKey = getConfigValue("evolution_api_key");

      if (!apiUrl || !apiKey) {
        toast.error("Configure a URL e API Key antes de testar");
        return;
      }

      setTestingConnection(true);
      try {
        const response = await supabase.functions.invoke("whatsapp-api", {
          body: { 
            action: "test-connection",
            apiUrl,
            apiKey,
            provider: "evolution"
          },
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        if (response.data?.success) {
          toast.success(response.data.message || "Conexão bem sucedida!");
        } else {
          toast.error(response.data?.error || response.data?.message || "Erro ao testar conexão");
        }
      } catch (error: any) {
        console.error("Connection test error:", error);
        toast.error(`Erro ao conectar: ${error.message || "Verifique a URL"}`);
      } finally {
        setTestingConnection(false);
      }
    }
  };

  const handleTestUazapiConnection = async () => {
    const subdomain = getConfigValue("uazapi_subdomain");
    const adminToken = getConfigValue("uazapi_admin_token");

    if (!subdomain || !adminToken) {
      toast.error("Configure o subdomínio e token antes de testar");
      return;
    }

    setTestingUazapi(true);
    try {
      const response = await supabase.functions.invoke("whatsapp-api", {
        body: { 
          action: "test-connection",
          apiUrl: subdomain,
          apiKey: adminToken,
          provider: "uazapi"
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.success) {
        toast.success(response.data.message || "Conexão UAZAPI bem sucedida!");
      } else {
        toast.error(response.data?.error || response.data?.message || "Erro ao testar conexão UAZAPI");
      }
    } catch (error: any) {
      console.error("UAZAPI connection test error:", error);
      toast.error(`Erro ao conectar UAZAPI: ${error.message || "Verifique as credenciais"}`);
    } finally {
      setTestingUazapi(false);
    }
  };

  const handleProviderChange = (newProvider: string) => {
    const currentProvider = getConfigValue("whatsapp_provider");
    if (currentProvider && currentProvider !== newProvider) {
      setProviderChanged(true);
    }
    handleUpdateConfig("whatsapp_provider", newProvider);
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getConfigValue = (key: string) => {
    return configs.find(c => c.key === key)?.value || "";
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

  const currentProvider = getConfigValue("whatsapp_provider") || "evolution";
  const evolutionConfigs = configs.filter(c => c.key.startsWith("evolution_"));
  const uazapiConfigs = configs.filter(c => c.key.startsWith("uazapi_"));
  const mercadoPagoConfigs = configs.filter(c => c.key.startsWith("mercadopago_"));
  const generalConfigs = configs.filter(c => 
    !c.key.startsWith("evolution_") && 
    !c.key.startsWith("mercadopago_") && 
    !c.key.startsWith("uazapi_") &&
    c.key !== "whatsapp_provider"
  );

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações do Sistema</h1>
          <p className="text-muted-foreground">
            Configure as credenciais de integração WhatsApp e parâmetros globais
          </p>
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate("/admin/test")} className="gap-2 border-primary text-primary hover:bg-primary/10">
              <Server className="w-4 h-4" />
              Acessar Simulador de Disparos (Testes API)
            </Button>
          </div>
        </div>

        {/* WhatsApp Provider Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Integração WhatsApp
              <Badge variant={currentProvider === "evolution" ? "default" : "secondary"}>
                {currentProvider === "evolution" ? "Evolution API" : "UAZAPI"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Selecione qual provider de WhatsApp utilizar. Ambos podem ser configurados, mas apenas um ficará ativo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Provider Ativo</Label>
              <Select value={currentProvider} onValueChange={handleProviderChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="evolution">Evolution API</SelectItem>
                  <SelectItem value="uazapi">UAZAPI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {providerChanged && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> Ao trocar de provider, todas as instâncias WhatsApp dos usuários precisarão ser reconectadas.
                  Salve as configurações e informe os usuários sobre a necessidade de reconexão.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Evolution API Config */}
        <Card className={currentProvider !== "evolution" ? "opacity-60" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Evolution API
              {currentProvider === "evolution" && (
                <Badge variant="outline" className="ml-2 text-green-600 border-green-600">Ativo</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Configure a conexão com a Evolution API. Estes dados serão usados por todos os clientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="evolution_api_url">URL da API</Label>
              <Input
                id="evolution_api_url"
                placeholder="https://sua-evolution-api.com"
                value={getConfigValue("evolution_api_url")}
                onChange={(e) => handleUpdateConfig("evolution_api_url", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                URL base da sua instalação da Evolution API
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="evolution_api_key">API Key / Token</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="evolution_api_key"
                    type={showSecrets["evolution_api_key"] ? "text" : "password"}
                    placeholder="Sua chave de API"
                    value={getConfigValue("evolution_api_key")}
                    onChange={(e) => handleUpdateConfig("evolution_api_key", e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => toggleSecretVisibility("evolution_api_key")}
                >
                  {showSecrets["evolution_api_key"] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="evolution_rate_limit_delay">Delay entre chamadas (ms)</Label>
                <Input
                  id="evolution_rate_limit_delay"
                  type="number"
                  placeholder="2000"
                  value={getConfigValue("evolution_rate_limit_delay")}
                  onChange={(e) => handleUpdateConfig("evolution_rate_limit_delay", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evolution_group_delay">Delay entre grupos (ms)</Label>
                <Input
                  id="evolution_group_delay"
                  type="number"
                  placeholder="3000"
                  value={getConfigValue("evolution_group_delay")}
                  onChange={(e) => handleUpdateConfig("evolution_group_delay", e.target.value)}
                />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testingConnection || currentProvider !== "evolution"}
              className="w-full"
            >
              {testingConnection ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando conexão...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Testar Conexão Evolution
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* UAZAPI Config */}
        <Card className={currentProvider !== "uazapi" ? "opacity-60" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              UAZAPI
              {currentProvider === "uazapi" && (
                <Badge variant="outline" className="ml-2 text-green-600 border-green-600">Ativo</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Configure a conexão com a UAZAPI. Alternativa à Evolution API com endpoints similares.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uazapi_subdomain">Subdomínio</Label>
              <Input
                id="uazapi_subdomain"
                placeholder="meuapp (sem .uazapi.com)"
                value={getConfigValue("uazapi_subdomain")}
                onChange={(e) => handleUpdateConfig("uazapi_subdomain", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Apenas o subdomínio. Ex: se sua URL é meuapp.uazapi.com, coloque apenas "meuapp"
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="uazapi_admin_token">Admin Token</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="uazapi_admin_token"
                    type={showSecrets["uazapi_admin_token"] ? "text" : "password"}
                    placeholder="Token administrativo da UAZAPI"
                    value={getConfigValue("uazapi_admin_token")}
                    onChange={(e) => handleUpdateConfig("uazapi_admin_token", e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => toggleSecretVisibility("uazapi_admin_token")}
                >
                  {showSecrets["uazapi_admin_token"] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Encontre em: Painel UAZAPI → Configurações → Token Admin
              </p>
            </div>

            <Button
              variant="outline"
              onClick={handleTestUazapiConnection}
              disabled={testingUazapi || currentProvider !== "uazapi"}
              className="w-full"
            >
              {testingUazapi ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando conexão UAZAPI...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Testar Conexão UAZAPI
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Mercado Pago Config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Mercado Pago
            </CardTitle>
            <CardDescription>
              Configure as credenciais do Mercado Pago para pagamentos via cartão (recorrente) e PIX.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mercadopago_access_token">Access Token (Produção)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="mercadopago_access_token"
                    type={showSecrets["mercadopago_access_token"] ? "text" : "password"}
                    placeholder="APP_USR-..."
                    value={getConfigValue("mercadopago_access_token")}
                    onChange={(e) => handleUpdateConfig("mercadopago_access_token", e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => toggleSecretVisibility("mercadopago_access_token")}
                >
                  {showSecrets["mercadopago_access_token"] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Encontre em: Mercado Pago → Seu negócio → Configurações → Credenciais
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mercadopago_public_key">Public Key</Label>
              <Input
                id="mercadopago_public_key"
                placeholder="APP_USR-..."
                value={getConfigValue("mercadopago_public_key")}
                onChange={(e) => handleUpdateConfig("mercadopago_public_key", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Chave pública para integração no frontend
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="mercadopago_webhook_secret">Webhook Secret (opcional)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="mercadopago_webhook_secret"
                    type={showSecrets["mercadopago_webhook_secret"] ? "text" : "password"}
                    placeholder="Segredo para validar webhooks"
                    value={getConfigValue("mercadopago_webhook_secret")}
                    onChange={(e) => handleUpdateConfig("mercadopago_webhook_secret", e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => toggleSecretVisibility("mercadopago_webhook_secret")}
                >
                  {showSecrets["mercadopago_webhook_secret"] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <h4 className="font-medium text-sm">URL do Webhook</h4>
              <code className="text-xs bg-background px-2 py-1 rounded block overflow-x-auto">
                {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-webhook`}
              </code>
              <p className="text-xs text-muted-foreground">
                Configure esta URL no painel do Mercado Pago → Webhooks → Criar webhook
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Modo de Teste</Label>
                <p className="text-xs text-muted-foreground">
                  Ativar para usar credenciais de sandbox
                </p>
              </div>
              <Switch
                checked={getConfigValue("mercadopago_sandbox") === "true"}
                onCheckedChange={(checked) => handleUpdateConfig("mercadopago_sandbox", checked ? "true" : "false")}
              />
            </div>
          </CardContent>
        </Card>

        {/* General Config */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações Gerais</CardTitle>
            <CardDescription>
              Parâmetros gerais do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default_timezone">Fuso Horário Padrão</Label>
              <Input
                id="default_timezone"
                placeholder="America/Sao_Paulo"
                value={getConfigValue("default_timezone")}
                onChange={(e) => handleUpdateConfig("default_timezone", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="log_retention_days">Retenção de Logs (dias)</Label>
              <Input
                id="log_retention_days"
                type="number"
                placeholder="90"
                value={getConfigValue("log_retention_days")}
                onChange={(e) => handleUpdateConfig("log_retention_days", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Logs mais antigos serão removidos automaticamente
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sticky Save Button Bar */}
        <div className="sticky bottom-4 mt-8 flex justify-end bg-background/80 backdrop-blur-md p-4 rounded-xl border shadow-lg z-50">
          <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-md">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Salvando Alterações...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
