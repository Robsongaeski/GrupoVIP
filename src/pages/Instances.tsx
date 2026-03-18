import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FormStepIndicator, Step } from "@/components/ui/form-step-indicator";
import { OnboardingCard, TipCard } from "@/components/ui/onboarding-card";
import { RequiredField } from "@/components/ui/required-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Smartphone,
  Plus,
  Wifi,
  WifiOff,
  QrCode,
  Trash2,
  RefreshCw,
  Loader2,
  Power,
  PowerOff,
  Users,
  CheckCircle2,
  ArrowRight,
  Link,
  MessageSquare,
  Zap,
  ShieldAlert,
} from "lucide-react";

interface Instance {
  id: string;
  name: string;
  instance_name: string;
  status: "connected" | "disconnected" | "connecting" | "qr_pending";
  phone_number: string | null;
  qr_code: string | null;
  last_connected_at: string | null;
  created_at: string;
}

export default function Instances() {
  const { user, session, loading: authLoading } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const navigate = useNavigate();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Wizard state
  const [wizardStep, setWizardStep] = useState(0);
  const [newInstanceId, setNewInstanceId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
  });

  // Generate unique instance name for Evolution API
  const generateInstanceName = () => {
    const userIdShort = user?.id?.substring(0, 8) || "user";
    const timestamp = Date.now().toString(36); // Base36 for shorter string
    return `inst_${userIdShort}_${timestamp}`;
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchInstances();
    }
  }, [user, effectiveUserId]);

  const fetchInstances = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInstances(data || []);
    } catch (error) {
      console.error("Error fetching instances:", error);
      toast.error("Erro ao carregar instâncias");
    } finally {
      setLoading(false);
    }
  };

  const callEvolutionApi = async (action: string, data: Record<string, unknown> = {}) => {
    const response = await supabase.functions.invoke("evolution-api", {
      body: { action, ...data },
    });

    if (response.error) {
      throw new Error(response.error.message || "Erro na API");
    }

    if (response.data?.error) {
      throw new Error(response.data.error);
    }

    return response.data;
  };

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Generate unique instance name automatically
      const instanceName = generateInstanceName();

      // First create in Evolution API (uses global config)
      await callEvolutionApi("create", {
        instanceName,
      });

      // Then save to database
      const { data, error } = await supabase.from("whatsapp_instances").insert({
        user_id: user!.id,
        name: formData.name,
        instance_name: instanceName,
        status: "disconnected",
      }).select().single();

      if (error) throw error;

      toast.success("Instância criada com sucesso!");
      setNewInstanceId(data.id);
      setWizardStep(1);
      fetchInstances();
    } catch (error: any) {
      console.error("Error creating instance:", error);
      if (error.code === "23505") {
        toast.error("Já existe uma instância com esse nome");
      } else {
        toast.error(error.message || "Erro ao criar instância");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleConnectNewInstance = async () => {
    if (!newInstanceId) return;
    
    const instance = instances.find(i => i.id === newInstanceId);
    if (instance) {
      await handleConnect(instance);
    }
  };

  const handleConnect = async (instance: Instance) => {
    setActionLoading(instance.id);
    try {
      const result = await callEvolutionApi("qrcode", { instanceId: instance.id });
      
      if (result.qrcode) {
        setSelectedInstance({ ...instance, qr_code: result.qrcode });
        setQrDialogOpen(true);
        if (newInstanceId === instance.id) {
          setWizardStep(1);
        }
      } else if (result.status === "open") {
        toast.success("Instância já está conectada!");
        if (newInstanceId === instance.id) {
          setWizardStep(2);
        }
        fetchInstances();
      } else {
        toast.info("Aguarde o QR Code...");
        // Try again after a moment
        setTimeout(async () => {
          const retry = await callEvolutionApi("qrcode", { instanceId: instance.id });
          if (retry.qrcode) {
            setSelectedInstance({ ...instance, qr_code: retry.qrcode });
            setQrDialogOpen(true);
          }
        }, 2000);
      }
    } catch (error: any) {
      console.error("Error connecting:", error);
      toast.error(error.message || "Erro ao conectar");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckStatus = async (instance: Instance) => {
    setActionLoading(instance.id);
    try {
      const result = await callEvolutionApi("status", { instanceId: instance.id });
      
      if (result.missingRemote) {
        toast.warning(result.message || "A instância sumiu do provedor e precisa ser recriada manualmente.");
        fetchInstances();
        return;
      }
      
      if (result.status === "open" && newInstanceId === instance.id) {
        setWizardStep(2);
        setQrDialogOpen(false);
      }
      
      const statusLabels: Record<string, string> = {
        connected: "Conectado",
        disconnected: "Desconectado",
        connecting: "Conectando",
        qr_pending: "Aguardando QR",
        open: "Conectado",
        close: "Desconectado"
      };
      
      toast.success(result.message || `Status: ${statusLabels[result.status] || result.status}`);
      fetchInstances();
    } catch (error: any) {
      toast.error(error.message || "Erro ao verificar status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (instance: Instance) => {
    if (!confirm("Tem certeza que deseja desconectar esta instância?")) return;
    
    setActionLoading(instance.id);
    try {
      await callEvolutionApi("disconnect", { instanceId: instance.id });
      toast.success("Instância desconectada!");
      fetchInstances();
    } catch (error: any) {
      toast.error(error.message || "Erro ao desconectar");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePurgeQueue = async (instance: Instance) => {
    if (!confirm(
      "⚠️ ATENÇÃO: Isso vai desconectar a instância, limpar toda a fila de mensagens do provedor e recriar do zero.\n\n" +
      "Use isso se mensagens antigas estão sendo reenviadas automaticamente.\n\n" +
      "Após a limpeza, você precisará reconectar via QR Code.\n\nDeseja continuar?"
    )) return;

    setActionLoading(instance.id);
    try {
      const result = await callEvolutionApi("purge-queue", { instanceId: instance.id });
      toast.success(result.message || "Fila limpa com sucesso! Reconecte via QR Code.");
      fetchInstances();
    } catch (error: any) {
      toast.error(error.message || "Erro ao limpar fila");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncGroups = async (instance: Instance) => {
    setActionLoading(instance.id);
    try {
      const result = await callEvolutionApi("fetch-groups", { instanceId: instance.id });
      toast.success(result.message || `${result.count} grupos sincronizados!`);
      
      if (newInstanceId === instance.id) {
        // Complete the wizard
        setDialogOpen(false);
        setWizardStep(0);
        setNewInstanceId(null);
        setFormData({ name: "" });
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao sincronizar grupos");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteInstance = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta instância? Isso também removerá a conexão na Evolution API.")) return;

    setActionLoading(id);
    try {
      // First delete from Evolution API
      try {
        await callEvolutionApi("delete", { instanceId: id });
      } catch (evolutionError) {
        console.error("Error deleting from Evolution API:", evolutionError);
        // Continue with database deletion even if Evolution API fails
      }

      // Then delete from database
      const { error } = await supabase
        .from("whatsapp_instances")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Instância excluída com sucesso!");
      fetchInstances();
    } catch (error) {
      console.error("Error deleting instance:", error);
      toast.error("Erro ao excluir instância");
    } finally {
      setActionLoading(null);
    }
  };

  const resetWizard = () => {
    setWizardStep(0);
    setNewInstanceId(null);
    setFormData({ name: "" });
    setDialogOpen(false);
  };

  const getStatusBadge = (status: Instance["status"]) => {
    const statusConfig = {
      connected: { label: "Conectado", variant: "default" as const, icon: Wifi, className: "bg-green-500" },
      disconnected: { label: "Desconectado", variant: "secondary" as const, icon: WifiOff, className: "" },
      connecting: { label: "Conectando", variant: "outline" as const, icon: RefreshCw, className: "" },
      qr_pending: { label: "Aguardando QR", variant: "outline" as const, icon: QrCode, className: "" },
    };

    const config = statusConfig[status];
    return (
      <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
        <config.icon className={`h-3 w-3 ${status === "connecting" ? "animate-spin" : ""}`} />
        {config.label}
      </Badge>
    );
  };

  // Wizard steps for new instance
  const wizardSteps: Step[] = [
    { id: "create", label: "Criar", icon: <Plus className="h-4 w-4" />, isComplete: wizardStep > 0 },
    { id: "connect", label: "Conectar", icon: <QrCode className="h-4 w-4" />, isComplete: wizardStep > 1 },
    { id: "sync", label: "Sincronizar", icon: <Users className="h-4 w-4" />, isComplete: wizardStep > 2 },
  ];

  const connectedInstances = instances.filter(i => i.status === "connected");

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
            <h1 className="text-3xl font-bold tracking-tight">Instâncias WhatsApp</h1>
            <p className="text-muted-foreground">
              Gerencie suas conexões com a Evolution API
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (!open) resetWizard();
            setDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Instância
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              {/* Wizard Step Indicator */}
              <div className="pb-4 border-b">
                <FormStepIndicator steps={wizardSteps} currentStep={wizardStep} />
              </div>

              {/* Step 0: Create Instance */}
              {wizardStep === 0 && (
                <form onSubmit={handleCreateInstance}>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Plus className="h-5 w-5 text-primary" />
                      </div>
                      Criar Nova Instância
                    </DialogTitle>
                    <DialogDescription>
                      Dê um nome para identificar esta conexão WhatsApp
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-6">
                    <RequiredField
                      label="Nome da Instância"
                      required
                      isValid={formData.name.length >= 3}
                      helpText="Use um nome que identifique facilmente esta conexão"
                    >
                      <Input
                        id="name"
                        placeholder="Ex: WhatsApp Vendas, Suporte, Marketing..."
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </RequiredField>

                    <TipCard
                      icon={Smartphone}
                      title="O que é uma instância?"
                      description="Uma instância representa uma conexão única com um número WhatsApp. Você pode ter múltiplas instâncias para diferentes números."
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving || formData.name.length < 3}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          Criar e Continuar
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              )}

              {/* Step 1: Connect WhatsApp */}
              {wizardStep === 1 && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-primary/10">
                        <QrCode className="h-5 w-5 text-primary" />
                      </div>
                      Conectar WhatsApp
                    </DialogTitle>
                    <DialogDescription>
                      Escaneie o QR Code para conectar seu WhatsApp
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-6 space-y-4">
                    <div className="flex justify-center">
                      <Button onClick={handleConnectNewInstance} disabled={actionLoading === newInstanceId}>
                        {actionLoading === newInstanceId ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <QrCode className="mr-2 h-4 w-4" />
                        )}
                        Gerar QR Code
                      </Button>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Como conectar:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Clique em "Gerar QR Code"</li>
                        <li>Abra o WhatsApp no seu celular</li>
                        <li>Vá em Configurações → Aparelhos Conectados</li>
                        <li>Toque em "Conectar um aparelho"</li>
                        <li>Escaneie o QR Code exibido</li>
                      </ol>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setWizardStep(2);
                    }}>
                      Pular por agora
                    </Button>
                  </DialogFooter>
                </>
              )}

              {/* Step 2: Sync Groups */}
              {wizardStep === 2 && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                      WhatsApp Conectado!
                    </DialogTitle>
                    <DialogDescription>
                      Agora vamos sincronizar seus grupos
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-6 space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                      <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                      <p className="font-medium text-green-700 dark:text-green-400">
                        Instância conectada com sucesso!
                      </p>
                    </div>

                    <p className="text-sm text-muted-foreground text-center">
                      Sincronize seus grupos para começar a usar as funcionalidades do sistema.
                    </p>

                    <div className="flex justify-center">
                      {newInstanceId && (
                        <Button 
                          onClick={() => {
                            const instance = instances.find(i => i.id === newInstanceId);
                            if (instance) handleSyncGroups(instance);
                          }}
                          disabled={actionLoading === newInstanceId}
                        >
                          {actionLoading === newInstanceId ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Users className="mr-2 h-4 w-4" />
                          )}
                          Sincronizar Grupos
                        </Button>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={resetWizard}>
                      Fazer depois
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                Conectar WhatsApp
              </DialogTitle>
              <DialogDescription>
                Escaneie o QR Code com seu WhatsApp para conectar
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-4">
              {selectedInstance?.qr_code ? (
                <div className="p-4 bg-white rounded-lg">
                  <img 
                    src={`data:image/png;base64,${selectedInstance.qr_code}`} 
                    alt="QR Code" 
                    className="w-64 h-64"
                  />
                </div>
              ) : (
                <div className="w-64 h-64 flex items-center justify-center border rounded-lg bg-muted">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center">
                <p className="font-medium text-foreground mb-1">Passo a passo:</p>
                <p>WhatsApp → Configurações → Aparelhos Conectados → Conectar</p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setQrDialogOpen(false);
                  fetchInstances();
                }}
                className="w-full sm:w-auto"
              >
                Fechar
              </Button>
              <Button 
                onClick={() => selectedInstance && handleCheckStatus(selectedInstance)}
                className="w-full sm:w-auto"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Verificar Conexão
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : instances.length === 0 ? (
          <OnboardingCard
            variant="hero"
            icon={Smartphone}
            title="Conecte seu primeiro WhatsApp"
            description="Crie uma instância para conectar seu número WhatsApp e começar a usar todas as funcionalidades do sistema."
            steps={[
              { label: "Criar instância", description: "Dê um nome para identificar" },
              { label: "Escanear QR Code", description: "Use seu celular" },
              { label: "Sincronizar grupos", description: "Importe seus grupos" },
            ]}
            actionLabel="Criar Primeira Instância"
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <>
            {/* Next Steps Card for first connected instance */}
            {connectedInstances.length === 1 && (
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    WhatsApp conectado! O que fazer agora?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate("/dashboard/groups")}>
                      <Users className="mr-2 h-4 w-4 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">Ver Grupos</p>
                        <p className="text-xs text-muted-foreground">Gerencie seus grupos</p>
                      </div>
                    </Button>
                    <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate("/dashboard/links")}>
                      <Link className="mr-2 h-4 w-4 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">Criar Link</p>
                        <p className="text-xs text-muted-foreground">Links inteligentes</p>
                      </div>
                    </Button>
                    <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate("/dashboard/campaigns")}>
                      <MessageSquare className="mr-2 h-4 w-4 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">Criar Campanha</p>
                        <p className="text-xs text-muted-foreground">Envie mensagens</p>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {instances.map((instance) => (
                <Card key={instance.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{instance.name}</CardTitle>
                      {getStatusBadge(instance.status)}
                    </div>
                    <CardDescription>{instance.instance_name}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {instance.phone_number && (
                      <div className="text-sm">
                        <p className="text-muted-foreground">Telefone</p>
                        <p className="font-medium">{instance.phone_number}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-3 gap-2">
                      {instance.status === "connected" ? (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleSyncGroups(instance)}
                            disabled={actionLoading === instance.id}
                          >
                            {actionLoading === instance.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Users className="mr-2 h-4 w-4" />
                            )}
                            Sincronizar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handlePurgeQueue(instance)}
                            disabled={actionLoading === instance.id}
                            className="text-amber-600 hover:text-amber-700 border-amber-200 hover:border-amber-300"
                            title="Limpa a fila de mensagens do provedor para parar mensagens fantasma"
                          >
                            {actionLoading === instance.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldAlert className="mr-2 h-4 w-4" />
                            )}
                            Limpar Fila
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDisconnect(instance)}
                            disabled={actionLoading === instance.id}
                            className="text-destructive hover:text-destructive"
                          >
                            <PowerOff className="mr-2 h-4 w-4" />
                            Desconectar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => handleConnect(instance)}
                            disabled={actionLoading === instance.id}
                            className="col-span-2"
                          >
                            {actionLoading === instance.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Power className="mr-2 h-4 w-4" />
                            )}
                            Conectar
                          </Button>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleCheckStatus(instance)}
                        disabled={actionLoading === instance.id}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${actionLoading === instance.id ? "animate-spin" : ""}`} />
                        Status
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteInstance(instance.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
