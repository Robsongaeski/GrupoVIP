import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Loader2, Plus, Pencil, Trash2, Crown, Package, Check, X } from "lucide-react";

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
  is_active: boolean;
  created_at: string;
}

interface PlanForm {
  name: string;
  description: string;
  price: string;
  periodicity: string;
  max_instances: string;
  max_groups: string;
  max_links: string;
  max_campaigns_month: string;
  features: string;
  is_active: boolean;
}

const emptyForm: PlanForm = {
  name: "",
  description: "",
  price: "0",
  periodicity: "monthly",
  max_instances: "1",
  max_groups: "10",
  max_links: "5",
  max_campaigns_month: "50",
  features: "",
  is_active: true,
};

export default function AdminPlans() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchPlans();
    }
  }, [user]);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("price", { ascending: true });

      if (error) throw error;
      
      setPlans(
        (data || []).map((p) => ({
          ...p,
          features: Array.isArray(p.features) ? (p.features as string[]) : [],
        }))
      );
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast.error("Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description || "",
      price: plan.price.toString(),
      periodicity: plan.periodicity,
      max_instances: plan.max_instances?.toString() || "",
      max_groups: plan.max_groups?.toString() || "",
      max_links: plan.max_links?.toString() || "",
      max_campaigns_month: plan.max_campaigns_month?.toString() || "",
      features: plan.features.join("\n"),
      is_active: plan.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nome do plano é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const planData = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price) || 0,
        periodicity: form.periodicity,
        max_instances: form.max_instances ? parseInt(form.max_instances) : null,
        max_groups: form.max_groups ? parseInt(form.max_groups) : null,
        max_links: form.max_links ? parseInt(form.max_links) : null,
        max_campaigns_month: form.max_campaigns_month ? parseInt(form.max_campaigns_month) : null,
        features: form.features.split("\n").filter((f) => f.trim()),
        is_active: form.is_active,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from("plans")
          .update(planData)
          .eq("id", editingPlan.id);

        if (error) throw error;
        toast.success("Plano atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("plans").insert(planData);

        if (error) throw error;
        toast.success("Plano criado com sucesso!");
      }

      setDialogOpen(false);
      fetchPlans();
    } catch (error: any) {
      console.error("Error saving plan:", error);
      toast.error(error.message || "Erro ao salvar plano");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    try {
      const { error } = await supabase.from("plans").delete().eq("id", plan.id);

      if (error) throw error;
      toast.success("Plano excluído com sucesso!");
      fetchPlans();
    } catch (error: any) {
      console.error("Error deleting plan:", error);
      toast.error(error.message || "Erro ao excluir plano");
    }
  };

  const handleToggleActive = async (plan: Plan) => {
    try {
      const { error } = await supabase
        .from("plans")
        .update({ is_active: !plan.is_active })
        .eq("id", plan.id);

      if (error) throw error;
      toast.success(plan.is_active ? "Plano desativado" : "Plano ativado");
      fetchPlans();
    } catch (error: any) {
      console.error("Error toggling plan:", error);
      toast.error(error.message || "Erro ao atualizar plano");
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
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

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Planos</h1>
            <p className="text-muted-foreground">
              Gerencie os planos disponíveis para os clientes
            </p>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Plano
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Planos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plans.length}</div>
              <p className="text-xs text-muted-foreground">
                {plans.filter((p) => p.is_active).length} ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Plano Gratuito</CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {plans.filter((p) => p.price === 0).length}
              </div>
              <p className="text-xs text-muted-foreground">
                {plans.filter((p) => p.price === 0 && p.is_active).length} ativo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planos Pagos</CardTitle>
              <Crown className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {plans.filter((p) => p.price > 0).length}
              </div>
              <p className="text-xs text-muted-foreground">
                {plans.filter((p) => p.price > 0 && p.is_active).length} ativos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Planos</CardTitle>
            <CardDescription>
              Clique em um plano para editar seus detalhes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-center">Instâncias</TableHead>
                  <TableHead className="text-center">Grupos</TableHead>
                  <TableHead className="text-center">Links</TableHead>
                  <TableHead className="text-center">Campanhas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhum plano cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="font-medium">{plan.name}</div>
                        {plan.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {plan.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={plan.price === 0 ? "text-green-600" : ""}>
                          {formatPrice(plan.price)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {plan.periodicity === "monthly" ? "Mensal" : "Anual"}
                      </TableCell>
                      <TableCell className="text-center">
                        {plan.max_instances ?? "∞"}
                      </TableCell>
                      <TableCell className="text-center">
                        {plan.max_groups ?? "∞"}
                      </TableCell>
                      <TableCell className="text-center">
                        {plan.max_links ?? "∞"}
                      </TableCell>
                      <TableCell className="text-center">
                        {plan.max_campaigns_month ?? "∞"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan.is_active ? "default" : "secondary"}>
                          {plan.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(plan)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(plan)}
                          >
                            {plan.is_active ? (
                              <X className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Plano</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o plano "{plan.name}"?
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(plan)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Editar Plano" : "Novo Plano"}
            </DialogTitle>
            <DialogDescription>
              {editingPlan
                ? "Atualize as informações do plano"
                : "Preencha as informações para criar um novo plano"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name">Nome do Plano *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Starter, Pro, Enterprise"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Breve descrição do plano"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Período</Label>
                <Select
                  value={form.periodicity}
                  onValueChange={(v) => setForm({ ...form, periodicity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_instances">Máx. Instâncias</Label>
                <Input
                  id="max_instances"
                  type="number"
                  min="0"
                  placeholder="Vazio = ilimitado"
                  value={form.max_instances}
                  onChange={(e) => setForm({ ...form, max_instances: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_groups">Máx. Grupos</Label>
                <Input
                  id="max_groups"
                  type="number"
                  min="0"
                  placeholder="Vazio = ilimitado"
                  value={form.max_groups}
                  onChange={(e) => setForm({ ...form, max_groups: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_links">Máx. Links</Label>
                <Input
                  id="max_links"
                  type="number"
                  min="0"
                  placeholder="Vazio = ilimitado"
                  value={form.max_links}
                  onChange={(e) => setForm({ ...form, max_links: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_campaigns">Máx. Campanhas/mês</Label>
                <Input
                  id="max_campaigns"
                  type="number"
                  min="0"
                  placeholder="Vazio = ilimitado"
                  value={form.max_campaigns_month}
                  onChange={(e) => setForm({ ...form, max_campaigns_month: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="features">Funcionalidades Extras</Label>
              <Textarea
                id="features"
                placeholder="Uma funcionalidade por linha&#10;Ex: Suporte prioritário&#10;Relatórios avançados"
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Uma funcionalidade por linha. Serão exibidas na lista de recursos do plano.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Plano Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Planos inativos não aparecem para os clientes
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : editingPlan ? (
                "Salvar Alterações"
              ) : (
                "Criar Plano"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
