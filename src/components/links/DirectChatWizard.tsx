import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormStepIndicator, Step } from "@/components/ui/form-step-indicator";
import { TipCard } from "@/components/ui/onboarding-card";
import { PhoneNumberInput } from "./PhoneNumberInput";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  Link as LinkIcon,
  Phone,
  Sparkles,
  Settings,
  Plus,
  Trash2,
  MessageSquare,
  BarChart2,
} from "lucide-react";

interface PhoneNumberInput {
  internal_name: string;
  phone_number: string;
  display_name: string;
  is_active: boolean;
}

interface UserPixel {
  id: string;
  name: string;
  pixel_id: string;
  is_default: boolean | null;
}

interface DirectChatFormData {
  name: string;
  slug: string;
  description: string;
  default_message: string;
  title: string;
  landing_description: string;
  logo_url: string;
  pixel_id: string;
  facebook_pixel_event: string;
}

interface DirectChatWizardProps {
  formData: DirectChatFormData;
  setFormData: (data: DirectChatFormData) => void;
  phoneNumbers: PhoneNumberInput[];
  setPhoneNumbers: (numbers: PhoneNumberInput[]) => void;
  userPixels: UserPixel[];
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
}

export function DirectChatWizard({
  formData,
  setFormData,
  phoneNumbers,
  setPhoneNumbers,
  userPixels,
  onSubmit,
  onCancel,
  saving,
}: DirectChatWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [newPhone, setNewPhone] = useState<PhoneNumberInput>({
    internal_name: "",
    phone_number: "",
    display_name: "",
    is_active: true,
  });

  const steps: Step[] = [
    { id: "basic", label: "Informações", icon: <LinkIcon className="h-5 w-5" /> },
    { id: "phones", label: "Números", icon: <Phone className="h-5 w-5" /> },
    { id: "message", label: "Mensagem", icon: <MessageSquare className="h-5 w-5" /> },
    { id: "landing", label: "Personalização", icon: <Sparkles className="h-5 w-5" /> },
  ];

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return formData.name.trim() !== "" && formData.slug.trim() !== "";
      case 1:
        return phoneNumbers.length > 0;
      case 2:
        return true; // Optional
      case 3:
        return true; // Optional
      default:
        return false;
    }
  };

  const handleNextStep = () => {
    if (!validateStep(currentStep)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onSubmit();
    }
  };

  const handlePreviousStep = () => {
    setShowErrors(false);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50);
  };

  const handleNameChange = (name: string) => {
    const newSlug = formData.slug === "" || formData.slug === generateSlug(formData.name)
      ? generateSlug(name)
      : formData.slug;
    setFormData({ ...formData, name, slug: newSlug });
  };

  const handleAddPhone = () => {
    if (!newPhone.internal_name.trim() || !newPhone.phone_number.trim()) {
      setShowErrors(true);
      return;
    }
    // Validar formato do número (pelo menos 10 dígitos)
    if (newPhone.phone_number.length < 10) {
      setShowErrors(true);
      return;
    }
    setPhoneNumbers([...phoneNumbers, { ...newPhone }]);
    setNewPhone({ internal_name: "", phone_number: "", display_name: "", is_active: true });
    setShowErrors(false);
  };

  const handleRemovePhone = (index: number) => {
    setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index));
  };

  const handleTogglePhone = (index: number) => {
    const updated = [...phoneNumbers];
    updated[index].is_active = !updated[index].is_active;
    setPhoneNumbers(updated);
  };

  const formatDisplayPhone = (phone: string) => {
    if (phone.length < 10) return phone;
    const country = phone.slice(0, 2);
    const ddd = phone.slice(2, 4);
    const part1 = phone.slice(4, 9);
    const part2 = phone.slice(9);
    return `+${country} (${ddd}) ${part1}-${part2}`;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <TipCard
              icon={Lightbulb}
              title="Link de Conversa Direta"
              description="Este link irá abrir uma conversa no WhatsApp com um número específico. Perfeito para atendimento, vendas ou suporte."
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-1">
                  Nome do Link <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Ex: Atendimento Vendas, Suporte VIP..."
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={showErrors && !formData.name.trim() ? "border-destructive" : ""}
                  autoFocus
                />
                {showErrors && !formData.name.trim() && (
                  <p className="text-sm text-destructive">O nome do link é obrigatório</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug" className="flex items-center gap-1">
                  Slug (URL) <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap bg-muted px-3 py-2 rounded-l-md border border-r-0">/go/</span>
                  <Input
                    id="slug"
                    placeholder="atendimento-vendas"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className={`rounded-l-none ${showErrors && !formData.slug.trim() ? "border-destructive" : ""}`}
                  />
                </div>
                {showErrors && !formData.slug.trim() && (
                  <p className="text-sm text-destructive">O slug é obrigatório</p>
                )}
                {formData.slug && (
                  <p className="text-xs text-muted-foreground">
                    URL final: {window.location.origin}/go/{formData.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o objetivo deste link para organização interna..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <TipCard
              icon={Lightbulb}
              title="Distribuição de Cliques"
              description="Os cliques serão distribuídos igualmente entre os números ativos. Você pode ativar/desativar números a qualquer momento."
            />

            {/* Lista de números adicionados */}
            {phoneNumbers.length > 0 && (
              <div className="space-y-2">
                <Label>Números Adicionados ({phoneNumbers.length})</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {phoneNumbers.map((phone, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        phone.is_active ? "bg-background" : "bg-muted/50 opacity-60"
                      }`}
                    >
                      <Switch
                        checked={phone.is_active}
                        onCheckedChange={() => handleTogglePhone(index)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{phone.internal_name}</p>
                          {!phone.is_active && (
                            <Badge variant="secondary" className="text-xs">Desativado</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDisplayPhone(phone.phone_number)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemovePhone(index)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulário para adicionar novo número */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <p className="text-sm font-medium">Adicionar Número</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nome interno *</Label>
                  <Input
                    placeholder="Ex: Vendedor João"
                    value={newPhone.internal_name}
                    onChange={(e) => setNewPhone({ ...newPhone, internal_name: e.target.value })}
                    className={showErrors && !newPhone.internal_name.trim() && phoneNumbers.length === 0 ? "border-destructive" : ""}
                  />
                </div>
                <div>
                  <Label className="text-xs">Nome exibição (opcional)</Label>
                  <Input
                    placeholder="Ex: João"
                    value={newPhone.display_name}
                    onChange={(e) => setNewPhone({ ...newPhone, display_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Número do WhatsApp *</Label>
                <div className="flex gap-2">
                  <PhoneNumberInput
                    value={newPhone.phone_number}
                    onChange={(value) => setNewPhone({ ...newPhone, phone_number: value })}
                    error={showErrors && !newPhone.phone_number.trim() && phoneNumbers.length === 0}
                  />
                  <Button type="button" onClick={handleAddPhone} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {showErrors && phoneNumbers.length === 0 && (
              <p className="text-sm text-destructive">Adicione pelo menos um número</p>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <TipCard
              icon={Lightbulb}
              title="Mensagem Pré-definida"
              description="Esta mensagem aparecerá automaticamente no campo de texto quando o visitante abrir a conversa no WhatsApp."
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="default_message">Mensagem Padrão (opcional)</Label>
                <Textarea
                  id="default_message"
                  placeholder="Olá! Vi seu link e gostaria de saber mais sobre..."
                  value={formData.default_message}
                  onChange={(e) => setFormData({ ...formData, default_message: e.target.value })}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  O visitante poderá editar a mensagem antes de enviar.
                </p>
              </div>

              {formData.default_message && phoneNumbers.length > 0 && (
                <div className="p-4 border rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-2">Preview da URL:</p>
                  <p className="text-sm font-mono break-all">
                    wa.me/{phoneNumbers[0]?.phone_number}?text={encodeURIComponent(formData.default_message).slice(0, 50)}...
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <TipCard
              icon={Lightbulb}
              title="Personalização (opcional)"
              description="Personalize a aparência da landing page e configure o rastreamento com Pixel do Facebook."
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título da Landing Page</Label>
                <Input
                  id="title"
                  placeholder="Ex: Fale com nossa equipe"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="landing_description">Descrição da Landing Page</Label>
                <Textarea
                  id="landing_description"
                  placeholder="Ex: Estamos prontos para te ajudar..."
                  value={formData.landing_description}
                  onChange={(e) => setFormData({ ...formData, landing_description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo_url">URL do Logo</Label>
                <Input
                  id="logo_url"
                  placeholder="https://exemplo.com/logo.png"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                />
              </div>

              {/* Facebook Pixel Selection */}
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Rastreamento Facebook Pixel</p>
                </div>
                
                {userPixels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum pixel cadastrado. Acesse <strong>Pixels</strong> no menu para cadastrar.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Pixel a Usar</Label>
                      <Select
                        value={formData.pixel_id || "none"}
                        onValueChange={(value) => setFormData({ ...formData, pixel_id: value === "none" ? "" : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um pixel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum pixel</SelectItem>
                          {userPixels.map((pixel) => (
                            <SelectItem key={pixel.id} value={pixel.id}>
                              {pixel.name} ({pixel.pixel_id}){pixel.is_default ? " - Padrão" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.pixel_id && (
                      <div className="space-y-2">
                        <Label className="text-xs">Evento a Disparar</Label>
                        <Select
                          value={formData.facebook_pixel_event || "PageView"}
                          onValueChange={(value) => setFormData({ ...formData, facebook_pixel_event: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o evento" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PageView">PageView</SelectItem>
                            <SelectItem value="Lead">Lead</SelectItem>
                            <SelectItem value="CompleteRegistration">CompleteRegistration</SelectItem>
                            <SelectItem value="Contact">Contact</SelectItem>
                            <SelectItem value="InitiateCheckout">InitiateCheckout</SelectItem>
                            <SelectItem value="Subscribe">Subscribe</SelectItem>
                            <SelectItem value="ViewContent">ViewContent</SelectItem>
                            <SelectItem value="AddToCart">AddToCart</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <FormStepIndicator
        steps={steps}
        currentStep={currentStep}
        onStepClick={(step) => {
          if (step < currentStep || validateStep(currentStep)) {
            setCurrentStep(step);
          }
        }}
      />

      <div className="min-h-[350px]">
        {renderStepContent()}
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={currentStep === 0 ? onCancel : handlePreviousStep}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 0 ? "Cancelar" : "Voltar"}
        </Button>

        <Button type="button" onClick={handleNextStep} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : currentStep === steps.length - 1 ? (
            "Criar Link"
          ) : (
            <>
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
