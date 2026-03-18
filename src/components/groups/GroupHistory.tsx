import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  History,
  Type,
  FileText,
  Image,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface GroupHistoryProps {
  groupId: string;
  groupName: string;
}

interface HistoryEntry {
  id: string;
  action_id: string | null;
  name_before: string | null;
  description_before: string | null;
  photo_url_before: string | null;
  created_at: string;
  group_actions: {
    id: string;
    action_type: "name" | "description" | "photo";
    new_value_text: string | null;
    new_value_file_url: string | null;
    status: string;
    executed_at: string | null;
  } | null;
}

export default function GroupHistory({ groupId, groupName }: GroupHistoryProps) {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, groupId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("group_snapshots")
        .select(`
          *,
          group_actions (
            id,
            action_type,
            new_value_text,
            new_value_file_url,
            status,
            executed_at
          )
        `)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory(data as unknown as HistoryEntry[] || []);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (entry: HistoryEntry) => {
    if (!entry.group_actions || !user) return;

    setReverting(entry.id);

    try {
      // Get the group's instance
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("instance_id")
        .eq("id", groupId)
        .single();

      if (groupError) throw groupError;

      // Create a new action to revert to previous state
      const { data: revertAction, error: revertError } = await supabase
        .from("group_actions")
        .insert({
          user_id: user.id,
          whatsapp_instance_id: group.instance_id,
          action_type: entry.group_actions.action_type,
          new_value_text: entry.group_actions.action_type === "name" 
            ? entry.name_before 
            : entry.group_actions.action_type === "description" 
              ? entry.description_before 
              : null,
          new_value_file_url: entry.group_actions.action_type === "photo" ? entry.photo_url_before : null,
          scheduled_at: new Date().toISOString(),
          status: "pending"
        })
        .select()
        .single();

      if (revertError) throw revertError;

      // Create target for the group
      const { error: targetError } = await supabase
        .from("group_action_targets")
        .insert({
          action_id: revertAction.id,
          group_id: groupId,
          status: "pending"
        });

      if (targetError) throw targetError;

      toast.success("Ação de reversão criada com sucesso");
      setIsOpen(false);
    } catch (error) {
      console.error("Error reverting:", error);
      toast.error("Erro ao criar ação de reversão");
    } finally {
      setReverting(null);
    }
  };

  const getActionTypeIcon = (type: string) => {
    switch (type) {
      case "name":
        return <Type className="h-4 w-4" />;
      case "description":
        return <FileText className="h-4 w-4" />;
      case "photo":
        return <Image className="h-4 w-4" />;
      default:
        return <History className="h-4 w-4" />;
    }
  };

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case "name":
        return "Nome";
      case "description":
        return "Descrição";
      case "photo":
        return "Foto";
      default:
        return type;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="mr-2 h-4 w-4" />
          Histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Alterações</DialogTitle>
          <DialogDescription>
            {groupName} - Últimas 20 alterações
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-center">
              Nenhum histórico de alteração encontrado
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => {
              const action = entry.group_actions;
              if (!action) return null;

              return (
                <Card key={entry.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-muted rounded">
                          {getActionTypeIcon(action.action_type)}
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            Alteração de {getActionTypeLabel(action.action_type)}
                          </CardTitle>
                          <CardDescription>
                            {action.executed_at
                              ? format(new Date(action.executed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevert(entry)}
                        disabled={reverting === entry.id}
                      >
                        {reverting === entry.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-2 h-4 w-4" />
                        )}
                        Reverter
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {action.action_type === "name" && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-muted p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Antes</p>
                          <p className="font-medium">{entry.name_before || "-"}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 bg-primary/10 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Depois</p>
                          <p className="font-medium">{action.new_value_text || "-"}</p>
                        </div>
                      </div>
                    )}

                    {action.action_type === "description" && (
                      <div className="space-y-2">
                        <div className="bg-muted p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Antes</p>
                          <p className="text-sm whitespace-pre-wrap line-clamp-3">
                            {entry.description_before || "-"}
                          </p>
                        </div>
                        <div className="flex justify-center">
                          <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                        </div>
                        <div className="bg-primary/10 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Depois</p>
                          <p className="text-sm whitespace-pre-wrap line-clamp-3">
                            {action.new_value_text || "-"}
                          </p>
                        </div>
                      </div>
                    )}

                    {action.action_type === "photo" && (
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-2">Antes</p>
                          {entry.photo_url_before ? (
                            <img
                              src={entry.photo_url_before}
                              alt="Foto anterior"
                              className="w-16 h-16 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                              <Image className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-2">Depois</p>
                          {action.new_value_file_url ? (
                            <img
                              src={action.new_value_file_url}
                              alt="Nova foto"
                              className="w-16 h-16 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                              <Image className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
