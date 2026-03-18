import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, BarChart2, ExternalLink, Plus, Pencil, Trash2, Star, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserPixel {
  id: string;
  name: string;
  pixel_id: string;
  is_default: boolean;
  created_at: string;
}

export default function PixelSettings() {
  const { user, loading: authLoading } = useAuth();
  const { effectiveUserId } = useImpersonation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pixels, setPixels] = useState<UserPixel[]>([]);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPixel, setEditingPixel] = useState<UserPixel | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pixelToDelete, setPixelToDelete] = useState<UserPixel | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    pixel_id: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchPixels();
    }
  }, [user]);

  const fetchPixels = async () => {
    try {
      const { data, error } = await supabase
        .from("user_pixels")
        .select("*")
        .eq("user_id", effectiveUserId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setPixels(data || []);
    } catch (error) {
      console.error("Error fetching pixels:", error);
      toast.error("Erro ao carregar pixels");
    } finally {
      setLoading(false);
    }
  };

  const openNewPixelDialog = () => {
    setEditingPixel(null);
    setFormData({ name: "", pixel_id: "" });
    setDialogOpen(true);
  };

  const openEditPixelDialog = (pixel: UserPixel) => {
    setEditingPixel(pixel);
    setFormData({ name: pixel.name, pixel_id: pixel.pixel_id });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.pixel_id.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setSaving(true);

    try {
      if (editingPixel) {
        // Update existing pixel
        const { error } = await supabase
          .from("user_pixels")
          .update({
            name: formData.name.trim(),
            pixel_id: formData.pixel_id.trim(),
          })
          .eq("id", editingPixel.id);

        if (error) throw error;
        toast.success("Pixel atualizado com sucesso!");
      } else {
        // Create new pixel
        const isFirst = pixels.length === 0;
        const { error } = await supabase
          .from("user_pixels")
          .insert({
            user_id: user!.id,
            name: formData.name.trim(),
            pixel_id: formData.pixel_id.trim(),
            is_default: isFirst, // First pixel is default
          });

        if (error) throw error;
        toast.success("Pixel criado com sucesso!");
      }

      setDialogOpen(false);
      fetchPixels();
    } catch (error) {
      console.error("Error saving pixel:", error);
      toast.error("Erro ao salvar pixel");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (pixel: UserPixel) => {
    try {
      // Remove default from all
      await supabase
        .from("user_pixels")
        .update({ is_default: false })
        .eq("user_id", user!.id);

      // Set new default
      const { error } = await supabase
        .from("user_pixels")
        .update({ is_default: true })
        .eq("id", pixel.id);

      if (error) throw error;
      toast.success("Pixel padrão definido!");
      fetchPixels();
    } catch (error) {
      console.error("Error setting default:", error);
      toast.error("Erro ao definir pixel padrão");
    }
  };

  const handleDelete = async () => {
    if (!pixelToDelete) return;

    try {
      const { error } = await supabase
        .from("user_pixels")
        .delete()
        .eq("id", pixelToDelete.id);

      if (error) throw error;
      toast.success("Pixel removido com sucesso!");
      setDeleteDialogOpen(false);
      setPixelToDelete(null);
      fetchPixels();
    } catch (error) {
      console.error("Error deleting pixel:", error);
      toast.error("Erro ao remover pixel");
    }
  };

  const confirmDelete = (pixel: UserPixel) => {
    setPixelToDelete(pixel);
    setDeleteDialogOpen(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pixels Meta</h1>
            <p className="text-muted-foreground">
              Gerencie seus Facebook/Meta Pixels para rastreamento de conversões
            </p>
          </div>
          <Button onClick={openNewPixelDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Pixel
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5" />
              Seus Pixels
            </CardTitle>
            <CardDescription>
              Cadastre múltiplos pixels para usar em diferentes links inteligentes.
              O pixel marcado com estrela será usado como padrão.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pixels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum pixel cadastrado</p>
                <p className="text-sm">Clique em "Novo Pixel" para adicionar seu primeiro pixel</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pixels.map((pixel) => (
                  <div
                    key={pixel.id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${pixel.is_default ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{pixel.name}</p>
                          {pixel.is_default && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Padrão
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">ID: {pixel.pixel_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!pixel.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSetDefault(pixel)}
                          title="Definir como padrão"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditPixelDialog(pixel)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => confirmDelete(pixel)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como encontrar seu Pixel ID?</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-2">
              <li>
                Acesse o{" "}
                <a
                  href="https://business.facebook.com/events_manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Meta Events Manager <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Selecione seu Pixel na lista de fontes de dados</li>
              <li>Copie o ID numérico exibido (ex: 1234567890123456)</li>
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPixel ? "Editar Pixel" : "Novo Pixel"}
            </DialogTitle>
            <DialogDescription>
              {editingPixel
                ? "Atualize as informações do seu pixel"
                : "Adicione um novo pixel para usar nos seus links inteligentes"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Pixel</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Pixel Principal, Pixel Vendas"
              />
              <p className="text-xs text-muted-foreground">
                Um nome para identificar facilmente este Pixel
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pixel_id">ID do Pixel</Label>
              <Input
                id="pixel_id"
                value={formData.pixel_id}
                onChange={(e) => setFormData({ ...formData, pixel_id: e.target.value })}
                placeholder="Ex: 1234567890123456"
              />
              <p className="text-xs text-muted-foreground">
                O ID numérico do seu Pixel encontrado no Meta Business Suite
              </p>
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
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Pixel?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o pixel "{pixelToDelete?.name}"?
              Links que usam este pixel deixarão de rastrear eventos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
