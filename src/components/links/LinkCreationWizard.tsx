import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Zap,
  Globe,
  Loader2,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Check,
  Lightbulb,
  Users,
  Link as LinkIcon,
  Sparkles,
  Settings,
  Plus,
  Trash2,
  BarChart2,
} from "lucide-react";

interface Group {
  id: string;
  name: string;
  member_count: number;
  max_members: number;
  invite_link: string | null;
  is_user_admin: boolean | null;
  whatsapp_id: string;
}

interface ManualGroupInput {
  internal_name: string;
  invite_url: string;
  click_limit: string;
}

interface UserPixel {
  id: string;
  name: string;
  pixel_id: string;
  is_default: boolean | null;
}

interface LinkFormData {
  name: string;
  slug: string;
  description: string;
  mode: "connected" | "manual" | "direct_chat";
  capacity_limit: string;
  title: string;
  landing_description: string;
  logo_url: string;
  no_vacancy_message: string;
  redirect_url: string;
  expires_at: string;
  pixel_id: string;
  facebook_pixel_event: string;
}

interface LinkCreationWizardProps {
  formData: LinkFormData;
  setFormData: (data: LinkFormData) => void;
  groups: Group[];
  selectedGroups: string[];
  setSelectedGroups: (groups: string[]) => void;
  manualGroupsToAdd: ManualGroupInput[];
  setManualGroupsToAdd: (groups: ManualGroupInput[]) => void;
  userPixels: UserPixel[];
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  fetchingInvite: string | null;
  onFetchInviteCode: (group: Group) => void;
}

const MAX_WHATSAPP_MEMBERS = 1024;

export function LinkCreationWizard({
  formData,
  setFormData,
  groups,
  selectedGroups,
  setSelectedGroups,
  manualGroupsToAdd,
  setManualGroupsToAdd,
  userPixels,
  onSubmit,
  onCancel,
  saving,
  fetchingInvite,
  onFetchInviteCode,
}: LinkCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [newManualGroup, setNewManualGroup] = useState<ManualGroupInput>({
    internal_name: "",
    invite_url: "",
    click_limit: "1000",
  });

  const steps: Step[] = [
    { id: "basic", label: "Informações", icon: <LinkIcon className="h-5 w-5" /> },
    { id: "groups", label: "Grupos", icon: <Users className="h-5 w-5" /> },
    { id: "landing", label: "Personalização", icon: <Sparkles className="h-5 w-5" /> },
    { id: "advanced", label: "Avançado", icon: <Settings className="h-5 w-5" /> },
  ];

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return formData.name.trim() !== "" && formData.slug.trim() !== "";
      case 1:
        if (formData.mode === "connected") {
          return selectedGroups.length > 0;
        }
        return manualGroupsToAdd.length > 0;
      case 2:
        return true; // Optional step
      case 3:
        return true; // Optional step
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

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(
      selectedGroups.includes(groupId)
        ? selectedGroups.filter(id => id !== groupId)
        : [...selectedGroups, groupId]
    );
  };

  const handleAddManualGroup = () => {
    if (!newManualGroup.internal_name.trim() || !newManualGroup.invite_url.trim()) {
      setShowErrors(true);
      return;
    }
    setManualGroupsToAdd([...manualGroupsToAdd, { ...newManualGroup }]);
    setNewManualGroup({ internal_name: "", invite_url: "", click_limit: "1000" });
    setShowErrors(false);
  };

  const handleRemoveManualGroup = (index: number) => {
    setManualGroupsToAdd(manualGroupsToAdd.filter((_, i) => i !== index));
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <TipCard
              icon={Lightbulb}
              title="Dica"
              description="Escolha um nome descritivo e um slug fácil de lembrar. O slug será parte da URL do seu link."
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-1">
                  Nome do Link <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Ex: Promoção de Verão, Grupo VIP..."
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
                    placeholder="promocao-verao"
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

              <div className="space-y-2">
                <Label>Modo de Operação</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      formData.mode === "connected"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setFormData({ ...formData, mode: "connected" })}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className={`h-5 w-5 ${formData.mode === "connected" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-medium">Conectado</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Usa grupos sincronizados com o WhatsApp
                    </p>
                  </button>
                  <button
                    type="button"
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      formData.mode === "manual"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setFormData({ ...formData, mode: "manual" })}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className={`h-5 w-5 ${formData.mode === "manual" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-medium">Manual</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Usa links de convite externos
                    </p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <TipCard
              icon={Lightbulb}
              title="Como funciona a distribuição"
              description={
                formData.mode === "connected"
                  ? "O sistema direciona visitantes automaticamente para os grupos com mais vagas disponíveis."
                  : "Adicione links de convite externos. O sistema distribui baseado no limite de cliques de cada grupo."
              }
            />

            {formData.mode === "connected" ? (
              <div className="space-y-4">
                {groups.length === 0 ? (
                  <div className="text-center py-8 border rounded-lg bg-muted/30">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground mb-2">Nenhum grupo ativo encontrado</p>
                    <p className="text-xs text-muted-foreground">
                      Ative grupos na página de Grupos primeiro
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {selectedGroups.length} grupo{selectedGroups.length !== 1 ? "s" : ""} selecionado{selectedGroups.length !== 1 ? "s" : ""}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const availableGroups = groups.filter(g => g.invite_link && g.member_count < MAX_WHATSAPP_MEMBERS);
                          setSelectedGroups(
                            selectedGroups.length === availableGroups.length
                              ? []
                              : availableGroups.map(g => g.id)
                          );
                        }}
                      >
                        {selectedGroups.length === groups.filter(g => g.invite_link).length
                          ? "Desmarcar todos"
                          : "Selecionar todos"}
                      </Button>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                      {groups.map((group) => {
                        const occupancy = (group.member_count / MAX_WHATSAPP_MEMBERS) * 100;
                        const isFull = group.member_count >= MAX_WHATSAPP_MEMBERS;
                        const isNearFull = occupancy >= 80;
                        const hasInviteLink = !!group.invite_link;
                        const isDisabled = !hasInviteLink || isFull;

                        return (
                          <div
                            key={group.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              selectedGroups.includes(group.id)
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50"
                            } ${isDisabled ? "opacity-60" : "cursor-pointer"}`}
                            onClick={() => !isDisabled && toggleGroup(group.id)}
                          >
                            <Checkbox
                              checked={selectedGroups.includes(group.id)}
                              onCheckedChange={() => !isDisabled && toggleGroup(group.id)}
                              disabled={isDisabled}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium truncate">{group.name}</p>
                                {!hasInviteLink && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onFetchInviteCode(group);
                                    }}
                                    disabled={fetchingInvite === group.id}
                                  >
                                    {fetchingInvite === group.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-3 w-3 mr-1" />
                                    )}
                                    Buscar Link
                                  </Button>
                                )}
                                {isFull && <Badge variant="destructive" className="text-xs">Cheio</Badge>}
                                {!isFull && isNearFull && (
                                  <Badge variant="secondary" className="text-xs">Quase cheio</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${
                                      isFull ? "bg-destructive" : "bg-primary"
                                    }`}
                                    style={{ width: `${Math.min(occupancy, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {group.member_count} membros
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {showErrors && selectedGroups.length === 0 && (
                      <p className="text-sm text-destructive">Selecione pelo menos um grupo</p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Nome interno *</Label>
                      <Input
                        placeholder="Ex: Grupo 1"
                        value={newManualGroup.internal_name}
                        onChange={(e) => setNewManualGroup({ ...newManualGroup, internal_name: e.target.value })}
                        className={showErrors && !newManualGroup.internal_name.trim() && manualGroupsToAdd.length === 0 ? "border-destructive" : ""}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Limite de cliques</Label>
                      <Input
                        type="number"
                        placeholder="1000"
                        value={newManualGroup.click_limit}
                        onChange={(e) => setNewManualGroup({ ...newManualGroup, click_limit: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Link de convite *</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://chat.whatsapp.com/..."
                        value={newManualGroup.invite_url}
                        onChange={(e) => setNewManualGroup({ ...newManualGroup, invite_url: e.target.value })}
                        className={`flex-1 ${showErrors && !newManualGroup.invite_url.trim() && manualGroupsToAdd.length === 0 ? "border-destructive" : ""}`}
                      />
                      <Button type="button" onClick={handleAddManualGroup} size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {manualGroupsToAdd.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Grupos adicionados ({manualGroupsToAdd.length})</Label>
                    {manualGroupsToAdd.map((group, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-lg border">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{group.internal_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{group.invite_url}</p>
                        </div>
                        <Badge variant="secondary">{group.click_limit} cliques</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-8 w-8"
                          onClick={() => handleRemoveManualGroup(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {showErrors && manualGroupsToAdd.length === 0 && (
                  <p className="text-sm text-destructive">Adicione pelo menos um grupo</p>
                )}
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <TipCard
              icon={Lightbulb}
              title="Personalização opcional"
              description="Configure uma landing page para engajar visitantes antes de redirecioná-los. Você pode pular esta etapa se preferir."
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título da Página</Label>
                <Input
                  id="title"
                  placeholder="Bem-vindo ao nosso grupo!"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="landing_description">Descrição da Landing Page</Label>
                <Textarea
                  id="landing_description"
                  placeholder="Junte-se a nossa comunidade exclusiva e tenha acesso a conteúdos incríveis..."
                  value={formData.landing_description}
                  onChange={(e) => setFormData({ ...formData, landing_description: e.target.value })}
                  rows={3}
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

              <div className="space-y-2">
                <Label htmlFor="no_vacancy_message">Mensagem de Sem Vagas</Label>
                <Textarea
                  id="no_vacancy_message"
                  placeholder="Todos os nossos grupos estão cheios no momento. Tente novamente mais tarde."
                  value={formData.no_vacancy_message}
                  onChange={(e) => setFormData({ ...formData, no_vacancy_message: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <TipCard
              icon={Lightbulb}
              title="Configurações avançadas"
              description="Defina limites, rastreamento e comportamentos especiais. Estas configurações são opcionais."
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="capacity_limit">Limite de Membros por Grupo</Label>
                <Input
                  id="capacity_limit"
                  type="number"
                  placeholder="1000"
                  value={formData.capacity_limit}
                  onChange={(e) => setFormData({ ...formData, capacity_limit: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Quando um grupo atingir este limite, novos membros serão direcionados para outros grupos
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="redirect_url">URL de Fallback</Label>
                <Input
                  id="redirect_url"
                  placeholder="https://wa.me/5511999999999"
                  value={formData.redirect_url}
                  onChange={(e) => setFormData({ ...formData, redirect_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Usado quando todos os grupos estão cheios ou indisponíveis
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires_at">Data de Expiração</Label>
                <Input
                  id="expires_at"
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Após esta data, o link ficará inativo automaticamente
                </p>
              </div>

              {/* Facebook Pixel Selection */}
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="h-5 w-5 text-primary" />
                  <h4 className="font-medium">Rastreamento Facebook Pixel</h4>
                </div>
                
                <div className="space-y-4">
                  {userPixels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum pixel cadastrado. Acesse <strong>Pixels</strong> no menu para cadastrar.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="pixel_id">Pixel a Usar</Label>
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
                        <p className="text-xs text-muted-foreground">
                          Escolha qual pixel será usado para rastrear este link
                        </p>
                      </div>

                      {formData.pixel_id && (
                        <div className="space-y-2">
                          <Label htmlFor="facebook_pixel_event">Evento a Disparar</Label>
                          <Select
                            value={formData.facebook_pixel_event || "PageView"}
                            onValueChange={(value) => setFormData({ ...formData, facebook_pixel_event: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o evento" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PageView">PageView (Visualização de Página)</SelectItem>
                              <SelectItem value="Lead">Lead (Potencial Cliente)</SelectItem>
                              <SelectItem value="CompleteRegistration">CompleteRegistration (Cadastro Completo)</SelectItem>
                              <SelectItem value="Contact">Contact (Contato)</SelectItem>
                              <SelectItem value="InitiateCheckout">InitiateCheckout (Início de Checkout)</SelectItem>
                              <SelectItem value="Subscribe">Subscribe (Inscrição)</SelectItem>
                              <SelectItem value="ViewContent">ViewContent (Visualização de Conteúdo)</SelectItem>
                              <SelectItem value="AddToCart">AddToCart (Adicionou ao Carrinho)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Escolha qual evento será registrado quando alguém acessar seu link
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
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
        onStepClick={(index) => {
          if (index < currentStep) {
            setCurrentStep(index);
          }
        }}
      />

      <div className="min-h-[400px]">{renderStepContent()}</div>

      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={currentStep === 0 ? onCancel : handlePreviousStep}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {currentStep === 0 ? "Cancelar" : "Anterior"}
        </Button>

        <div className="flex items-center gap-2">
          {currentStep >= 2 && currentStep < steps.length - 1 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCurrentStep(currentStep + 1)}
            >
              Pular
            </Button>
          )}
          <Button type="button" onClick={handleNextStep} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : currentStep === steps.length - 1 ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            {currentStep === steps.length - 1 ? "Criar Link" : "Próximo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
