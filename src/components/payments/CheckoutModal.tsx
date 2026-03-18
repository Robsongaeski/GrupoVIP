import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CreditCard, Lock, AlertCircle, QrCode, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Plan {
  id: string;
  name: string;
  price: number;
  periodicity: string;
}

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
  onSuccess: () => void;
}

declare global {
  interface Window {
    MercadoPago: any;
  }
}

export default function CheckoutModal({ open, onOpenChange, plan, onSuccess }: CheckoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [mpLoaded, setMpLoaded] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "pix">("card");
  
  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expirationMonth, setExpirationMonth] = useState("");
  const [expirationYear, setExpirationYear] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [docType, setDocType] = useState("CPF");
  const [docNumber, setDocNumber] = useState("");
  
  // PIX fields
  const [pixQrCode, setPixQrCode] = useState("");
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState("");
  const [pixCopied, setPixCopied] = useState(false);
  const [pixGenerated, setPixGenerated] = useState(false);
  
  const [error, setError] = useState("");

  // Carregar SDK do Mercado Pago
  useEffect(() => {
    if (open && !mpLoaded) {
      loadMercadoPagoSDK();
    }
  }, [open]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const loadMercadoPagoSDK = async () => {
    try {
      // Buscar chave pública primeiro
      const { data: config, error: configError } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'mercadopago_public_key')
        .single();

      if (configError) {
        console.error("Error fetching MP public key:", configError);
        setError("Erro ao buscar configuração de pagamento");
        return;
      }

      if (!config?.value) {
        setError("Chave pública do Mercado Pago não configurada");
        return;
      }

      console.log("MP Public Key found, loading SDK...");

      // Se já temos uma instância inicializada, apenas marca como pronto
      if (window.MercadoPago && typeof window.MercadoPago.createCardToken === 'function') {
        console.log("MP SDK already initialized");
        setMpLoaded(true);
        setError("");
        return;
      }

      // Se o SDK está carregado mas como função (não instanciado), instancia
      if (window.MercadoPago && typeof window.MercadoPago === 'function') {
        console.log("MP SDK loaded, initializing...");
        try {
          window.MercadoPago = new window.MercadoPago(config.value, { locale: 'pt-BR' });
          setMpLoaded(true);
          setError("");
          console.log("MP SDK initialized successfully");
        } catch (initError: any) {
          console.error("MP SDK init error:", initError);
          setError("Erro ao inicializar gateway: " + initError.message);
        }
        return;
      }

      // Precisa carregar o script
      // Remove script anterior se existir
      const existingScript = document.querySelector('script[src*="sdk.mercadopago.com"]');
      if (existingScript) {
        console.log("Removing existing MP script");
        existingScript.remove();
        // Limpar referência global
        delete (window as any).MercadoPago;
      }

      console.log("Loading MP SDK script...");
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.async = true;
      
      script.onload = () => {
        console.log("MP SDK script loaded");
        try {
          if (typeof window.MercadoPago === 'function') {
            console.log("Initializing MP SDK...");
            window.MercadoPago = new window.MercadoPago(config.value, { locale: 'pt-BR' });
            setMpLoaded(true);
            setError("");
            console.log("MP SDK initialized successfully");
          } else {
            console.error("MercadoPago not available after script load");
            setError("SDK do Mercado Pago não inicializou corretamente");
          }
        } catch (initError: any) {
          console.error("MP SDK init error:", initError);
          setError("Erro ao inicializar gateway: " + initError.message);
        }
      };
      
      script.onerror = (e) => {
        console.error("MP SDK load error:", e);
        setError("Erro ao carregar SDK do Mercado Pago. Verifique se há bloqueador de anúncios ativo.");
      };
      
      document.body.appendChild(script);
    } catch (err: any) {
      console.error("loadMercadoPagoSDK error:", err);
      setError("Erro inesperado: " + err.message);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatCPF = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length <= 11) {
      return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!window.MercadoPago) {
        throw new Error("Gateway de pagamento não carregado");
      }

      const cardData = {
        cardNumber: cardNumber.replace(/\s/g, ''),
        cardholderName,
        cardExpirationMonth: expirationMonth,
        cardExpirationYear: expirationYear,
        securityCode,
        identificationType: docType,
        identificationNumber: docNumber.replace(/\D/g, ''),
      };

      console.log("Creating card token...");
      
      const mp = window.MercadoPago;
      const cardTokenResult = await mp.createCardToken(cardData);

      if (cardTokenResult.error) {
        console.error("Card token error:", cardTokenResult);
        throw new Error(cardTokenResult.cause?.[0]?.description || "Erro ao processar cartão");
      }

      console.log("Card token created:", cardTokenResult.id);

      const { data, error: fnError } = await supabase.functions.invoke('create-subscription', {
        body: { 
          plan_id: plan?.id,
          payment_method: 'card',
          card_token: cardTokenResult.id,
          payment_method_id: cardTokenResult.payment_method?.id || 'visa',
          payer: {
            identification: {
              type: docType,
              number: docNumber.replace(/\D/g, '')
            }
          }
        }
      });

      if (fnError) throw fnError;

      if (data.success) {
        toast.success("Assinatura realizada com sucesso!");
        onOpenChange(false);
        onSuccess();
        resetForm();
      } else {
        throw new Error(data.error || "Erro ao processar pagamento");
      }

    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message || "Erro ao processar pagamento");
      toast.error(err.message || "Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const handlePixGenerate = async () => {
    setError("");
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-subscription', {
        body: { 
          plan_id: plan?.id,
          payment_method: 'pix',
          payer: {
            identification: {
              type: docType,
              number: docNumber.replace(/\D/g, '')
            }
          }
        }
      });

      if (fnError) throw fnError;

      if (data.success && data.pix) {
        setPixQrCode(data.pix.qr_code);
        setPixQrCodeBase64(data.pix.qr_code_base64);
        setPixGenerated(true);
        toast.success("PIX gerado! Escaneie o QR Code ou copie o código.");
      } else {
        throw new Error(data.error || "Erro ao gerar PIX");
      }

    } catch (err: any) {
      console.error("PIX error:", err);
      setError(err.message || "Erro ao gerar PIX");
      toast.error(err.message || "Erro ao gerar PIX");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(pixQrCode);
      setPixCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setPixCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar código");
    }
  };

  const resetForm = () => {
    setCardNumber("");
    setCardholderName("");
    setExpirationMonth("");
    setExpirationYear("");
    setSecurityCode("");
    setDocNumber("");
    setError("");
    setPixQrCode("");
    setPixQrCodeBase64("");
    setPixGenerated(false);
    setPixCopied(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => (currentYear + i).toString());
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md z-[200]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Finalizar Assinatura
          </DialogTitle>
          <DialogDescription>
            {plan.name} - {formatPrice(plan.price)}/{plan.periodicity === 'monthly' ? 'mês' : 'ano'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "card" | "pix")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="card" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Cartão
            </TabsTrigger>
            <TabsTrigger value="pix" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              PIX
            </TabsTrigger>
          </TabsList>

          <TabsContent value="card" className="mt-4">
            <form onSubmit={handleCardSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="cardNumber">Número do Cartão</Label>
                <Input
                  id="cardNumber"
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  maxLength={19}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardholderName">Nome no Cartão</Label>
                <Input
                  id="cardholderName"
                  placeholder="Como está impresso no cartão"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select value={expirationMonth} onValueChange={setExpirationMonth} required>
                    <SelectTrigger>
                      <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent className="z-[300]">
                      {months.map((month) => (
                        <SelectItem key={month} value={month}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Select value={expirationYear} onValueChange={setExpirationYear} required>
                    <SelectTrigger>
                      <SelectValue placeholder="AAAA" />
                    </SelectTrigger>
                    <SelectContent className="z-[300]">
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    placeholder="123"
                    value={securityCode}
                    onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Documento</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[300]">
                      <SelectItem value="CPF">CPF</SelectItem>
                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="docNumber">Número</Label>
                  <Input
                    id="docNumber"
                    placeholder={docType === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
                    value={docNumber}
                    onChange={(e) => setDocNumber(formatCPF(e.target.value))}
                    maxLength={docType === "CPF" ? 14 : 18}
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                <p className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  <strong>Cobrança recorrente:</strong> Seu cartão será cobrado automaticamente todo mês.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Seus dados são criptografados e processados com segurança
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !mpLoaded}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : !mpLoaded ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Pagar {formatPrice(plan.price)}
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="pix" className="mt-4">
            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {!pixGenerated ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Documento</Label>
                      <Select value={docType} onValueChange={setDocType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[300]">
                          <SelectItem value="CPF">CPF</SelectItem>
                          <SelectItem value="CNPJ">CNPJ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="pixDocNumber">Número</Label>
                      <Input
                        id="pixDocNumber"
                        placeholder={docType === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
                        value={docNumber}
                        onChange={(e) => setDocNumber(formatCPF(e.target.value))}
                        maxLength={docType === "CPF" ? 14 : 18}
                        required
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                    <p className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      <strong>Pagamento único:</strong> O PIX não é recorrente. Você precisará pagar manualmente a cada renovação.
                    </p>
                  </div>

                  <Button 
                    onClick={handlePixGenerate} 
                    className="w-full" 
                    disabled={loading || !docNumber}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando PIX...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Gerar PIX - {formatPrice(plan.price)}
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-4">
                    {pixQrCodeBase64 && (
                      <div className="p-4 bg-white rounded-lg">
                        <img 
                          src={`data:image/png;base64,${pixQrCodeBase64}`} 
                          alt="QR Code PIX" 
                          className="w-48 h-48"
                        />
                      </div>
                    )}

                    <div className="w-full">
                      <Label className="text-xs text-muted-foreground">Código PIX (Copia e Cola)</Label>
                      <div className="flex gap-2 mt-1">
                        <Input 
                          value={pixQrCode} 
                          readOnly 
                          className="text-xs font-mono"
                        />
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={handleCopyPix}
                        >
                          {pixCopied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="text-center text-sm text-muted-foreground">
                      <p>Escaneie o QR Code ou copie o código acima para pagar.</p>
                      <p className="text-xs mt-1">O pagamento expira em 30 minutos.</p>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setPixGenerated(false);
                      setPixQrCode("");
                      setPixQrCodeBase64("");
                    }}
                  >
                    Gerar Novo PIX
                  </Button>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
