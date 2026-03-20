import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, QrCode, Play, Send, RefreshCw, XCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function AdminApiTest() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<"evolution" | "uazapi">("uazapi");
  
  // Instance state
  const [instanceName, setInstanceName] = useState("");
  const [instanceToken, setInstanceToken] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [status, setStatus] = useState<string>("disconnected");
  const [phoneNumber, setPhoneNumber] = useState("");
  
  // Message test state
  const [targetNumber, setTargetNumber] = useState("");
  const [messageText, setMessageText] = useState("Mensagem de Teste do Simulador GrupoVIP!");
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Handle Instance Creation
  const handleCreateInstance = async () => {
    setLoading(true);
    setQrCode("");
    setStatus("disconnected");
    setPhoneNumber("");
    
    // Generate isolated instance name
    const newName = `test_simulador_${Math.floor(Math.random() * 10000)}`;
    setInstanceName(newName);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api", {
        body: { 
          action: "create", 
          instanceName: newName,
          providerOverride: provider
        }
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Erro ao criar instância");

      if (data.instanceToken) {
        setInstanceToken(data.instanceToken);
      }

      toast.success("Instância de teste criada. Solicitando conexão...");
      await handleConnectInstance(newName, data.instanceToken);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Falha ao criar instância.");
    } finally {
      setLoading(false);
    }
  };

  // Handle get connection / QR
  const handleConnectInstance = async (name: string, tokenOverride?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api", {
        body: { 
          action: "connect", 
          instanceName: name,
          instanceToken: tokenOverride || instanceToken,
          providerOverride: provider 
        }
      });

      if (error) throw new Error(error.message);

      if (data.status === "connected" || data.status === "open") {
        setStatus("connected");
        toast.success("Instância já está conectada!");
        checkStatus(name);
      } else if (data.qrcode) {
        setQrCode(data.qrcode);
        setStatus("qr_pending");
      } else {
        setStatus(data.status || "connecting");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao obtrer QR Code.");
    } finally {
      setLoading(false);
    }
  };

  // Check Status Periodic
  const checkStatus = async (name: string = instanceName) => {
    if (!name) return;
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api", {
        body: { 
          action: "status", 
          instanceName: name,
          instanceToken: instanceToken,
          providerOverride: provider 
        }
      });

      if (error) throw new Error(error.message);
      
      const stat = data.status;
      setStatus(stat);
      
      if (data.phoneNumber) {
        setPhoneNumber(data.phoneNumber);
      }

      if (stat === "connected") {
        setQrCode("");
        toast.success("Conectado com sucesso!");
      }
    } catch (err) {
      console.error("Status check error", err);
    }
  };

  // Disconnect/Logout
  const handleLogout = async () => {
    if (!instanceName) return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-api", {
        body: { 
          action: "logout", 
          instanceName,
          providerOverride: provider 
        }
      });
      if (error) throw new Error(error.message);
      
      setStatus("disconnected");
      setInstanceName("");
      setQrCode("");
      setPhoneNumber("");
      toast.success("Desconectado do teste.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao desconectar");
    } finally {
      setLoading(false);
    }
  };

  // Send Message
  const handleSendMessage = async () => {
    if (!instanceName || status !== "connected") {
      toast.error("Você precisa estar conectado primeiro.");
      return;
    }
    if (!targetNumber || !messageText) {
      toast.error("Preencha o número de destino e o texto.");
      return;
    }

    setSendingMsg(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api", {
        body: { 
          action: "send-text", 
          instanceName,
          instanceToken: instanceToken,
          groupId: targetNumber,
          text: messageText,
          providerOverride: provider 
        }
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Falha recusada pelo servidor");

      toast.success("Mensagem enviada com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao disparar mensagem");
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Simulador Base da API (Testes Isolados)</h1>
          <p className="text-muted-foreground mt-2">
            Utilize esta tela para testar os dois provedores de comunicação (Evolution API ou UAZAPI) sem afetar o provedor global ou o banco de dados dos clientes.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Definir Provedor Base</CardTitle>
            <CardDescription>Escolha o provedor de disparo para este teste isolado.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label>Forçar Provedor</Label>
                <Select value={provider} onValueChange={(v: any) => setProvider(v)} disabled={!!instanceName}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uazapi">UAZAPI</SelectItem>
                    <SelectItem value="evolution">Evolution API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateInstance} disabled={loading || !!instanceName} className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Criar Instância de Teste
              </Button>
            </div>
          </CardContent>
        </Card>

        {instanceName && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>2. Conexão & QR Code</CardTitle>
                <CardDescription>Instância Temporária: {instanceName}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
                {status === "qr_pending" && qrCode ? (
                  <div className="p-4 bg-white rounded-lg shadow-sm border flex flex-col items-center">
                    {qrCode.startsWith("data:image") ? (
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                    ) : (
                      <QRCodeSVG value={qrCode} size={200} />
                    )}
                    <p className="mt-4 text-sm text-slate-500 text-center">Escaneie com seu WhatsApp Secundário</p>
                  </div>
                ) : status === "connected" ? (
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Send className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-medium text-slate-800">Conectado!</h3>
                    <p className="text-slate-500">Módulo operante via {provider.toUpperCase()}</p>
                    {phoneNumber && <p className="font-bold text-slate-700 bg-slate-100 py-1 rounded">+{phoneNumber}</p>}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                    <p>Aguardando status da conexão...</p>
                  </div>
                )}

                <div className="flex gap-2 mt-4 pt-4 border-t w-full justify-center">
                  <Button variant="outline" size="sm" onClick={() => checkStatus()} disabled={loading} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Checar Status
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleLogout} disabled={loading} className="gap-2">
                    <XCircle className="w-4 h-4" /> Desconectar Instância
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className={status !== "connected" ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
              <CardHeader>
                <CardTitle>3. Prova de Fogo (Disparo)</CardTitle>
                <CardDescription>Envie uma mensagem literal para validar se a rota está ativa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Número Destino (Ex: 5511999999999)</Label>
                  <Input 
                    value={targetNumber} 
                    onChange={e => setTargetNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="Somente números..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Input 
                    value={messageText} 
                    onChange={e => setMessageText(e.target.value)}
                  />
                </div>
                <Button onClick={handleSendMessage} disabled={sendingMsg || status !== "connected"} className="w-full gap-2">
                  {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Disparar Mensagem Agora
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
