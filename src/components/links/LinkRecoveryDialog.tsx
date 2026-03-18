import { useState } from "react";
import { RefreshCw, Check, AlertCircle, Link as LinkIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface LinkRecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkId?: string;
  linkName?: string;
  recoverAll?: boolean;
  onRecovered: () => void;
}

export function LinkRecoveryDialog({
  open,
  onOpenChange,
  linkId,
  linkName,
  recoverAll = false,
  onRecovered,
}: LinkRecoveryDialogProps) {
  const { user } = useAuth();
  const [recovering, setRecovering] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count: number } | null>(null);

  const handleRecover = async () => {
    if (!user) return;

    setRecovering(true);
    setResult(null);

    try {
      if (recoverAll) {
        // Recover all orphaned links
        const { data: orphanedLinks, error: fetchError } = await supabase.rpc(
          'get_orphaned_links',
          { p_user_id: user.id }
        );

        if (fetchError) throw fetchError;

        let totalRecovered = 0;

        for (const link of orphanedLinks || []) {
          if (link.recoverable_groups > 0) {
            const { data, error } = await supabase.rpc('recover_link_groups', {
              p_link_id: link.link_id,
              p_user_id: user.id
            });

            if (!error && data) {
              totalRecovered += data;
            }
          }
        }

        setResult({ success: true, count: totalRecovered });
        
        if (totalRecovered > 0) {
          toast.success(
            `${totalRecovered} grupo${totalRecovered !== 1 ? 's' : ''} recuperado${totalRecovered !== 1 ? 's' : ''} com sucesso!`
          );
        } else {
          toast.info("Nenhum grupo disponível para recuperação");
        }
      } else if (linkId) {
        // Recover specific link
        const { data, error } = await supabase.rpc('recover_link_groups', {
          p_link_id: linkId,
          p_user_id: user.id
        });

        if (error) throw error;

        const recovered = data || 0;
        setResult({ success: true, count: recovered });

        if (recovered > 0) {
          toast.success(
            `${recovered} grupo${recovered !== 1 ? 's' : ''} recuperado${recovered !== 1 ? 's' : ''} para "${linkName}"!`
          );
        } else {
          toast.info("Nenhum grupo disponível para recuperação neste link");
        }
      }

      onRecovered();
    } catch (error: any) {
      console.error("Error recovering groups:", error);
      toast.error(error.message || "Erro ao recuperar grupos");
      setResult({ success: false, count: 0 });
    } finally {
      setRecovering(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-amber-500" />
            {recoverAll ? "Recuperar Todos os Grupos" : `Recuperar Grupos`}
          </DialogTitle>
          <DialogDescription>
            {recoverAll ? (
              "Isso irá reconectar automaticamente todos os grupos que foram desvinculados de seus links inteligentes."
            ) : (
              <>
                Recuperar grupos desvinculados do link <strong>"{linkName}"</strong>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {result ? (
            <div className={`flex items-center gap-3 p-4 rounded-lg ${
              result.success ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'
            }`}>
              {result.success ? (
                <>
                  <Check className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Recuperação concluída!</p>
                    <p className="text-sm opacity-80">
                      {result.count > 0 
                        ? `${result.count} grupo${result.count !== 1 ? 's' : ''} foi${result.count !== 1 ? 'ram' : ''} reconectado${result.count !== 1 ? 's' : ''}.`
                        : "Nenhum grupo precisava ser recuperado."
                      }
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Erro na recuperação</p>
                    <p className="text-sm opacity-80">
                      Não foi possível recuperar os grupos. Tente novamente.
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <LinkIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">
                  Quando você desconecta ou remove uma instância do WhatsApp, os grupos são 
                  desvinculados dos links inteligentes.
                </p>
                <p>
                  Esta função irá reconectar automaticamente os grupos que foram sincronizados 
                  novamente com a mesma conta (identificados pelo ID do grupo no WhatsApp).
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <Button onClick={handleClose}>
              Fechar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={recovering}>
                Cancelar
              </Button>
              <Button onClick={handleRecover} disabled={recovering}>
                {recovering ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Recuperando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Recuperar Grupos
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
