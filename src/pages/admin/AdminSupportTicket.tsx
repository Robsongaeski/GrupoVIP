import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/layout/AdminLayout";
import { TicketMessages } from "@/components/support/TicketMessages";
import { TicketReplyForm } from "@/components/support/TicketReplyForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Clock, Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

type TicketStatus = "open" | "in_progress" | "waiting_customer" | "waiting_support" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  user_id: string;
  profiles?: {
    email: string;
    full_name: string | null;
  };
}

interface Message {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  user_id: string;
  attachments?: any[];
}

const statusConfig: Record<TicketStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Aberto", variant: "default" },
  in_progress: { label: "Em Atendimento", variant: "secondary" },
  waiting_customer: { label: "Aguardando Cliente", variant: "destructive" },
  waiting_support: { label: "Aguardando Suporte", variant: "outline" },
  resolved: { label: "Resolvido", variant: "secondary" },
  closed: { label: "Fechado", variant: "outline" },
};

const priorityConfig: Record<TicketPriority, { label: string; className: string }> = {
  low: { label: "Baixa", className: "" },
  medium: { label: "Média", className: "" },
  high: { label: "Alta", className: "text-orange-500" },
  urgent: { label: "Urgente", className: "text-destructive" },
};

const categoryLabels: Record<string, string> = {
  technical: "Dúvida Técnica",
  campaign: "Problema com Campanha",
  instance: "Problema com Instância",
  billing: "Cobrança/Pagamento",
  feedback: "Sugestão/Feedback",
  other: "Outro",
};

export default function AdminSupportTicket() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchTicket = async () => {
    if (!id) return;

    try {
      // Buscar ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", id)
        .single();

      if (ticketError) throw ticketError;

      // Buscar perfil do usuário
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", (ticketData as any).user_id)
        .single();

      setTicket({ ...(ticketData as any), profiles: profile } as Ticket);

      // Buscar mensagens
      const { data: messagesData, error: messagesError } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      // Buscar anexos para cada mensagem
      const messagesWithAttachments = await Promise.all(
        (messagesData || []).map(async (msg) => {
          const { data: attachments } = await supabase
            .from("ticket_attachments")
            .select("*")
            .eq("message_id", msg.id);
          return { ...msg, attachments: attachments || [] };
        })
      );

      setMessages(messagesWithAttachments);
    } catch (error) {
      console.error("Erro ao buscar ticket:", error);
      toast({
        title: "Erro",
        description: "Ticket não encontrado",
        variant: "destructive",
      });
      navigate("/admin/support");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const updateStatus = async (newStatus: TicketStatus) => {
    if (!ticket) return;

    setUpdating(true);
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === "resolved" || newStatus === "closed") {
        updateData.resolved_at = new Date().toISOString();
      } else {
        updateData.resolved_at = null;
      }

      const { error } = await supabase
        .from("support_tickets")
        .update(updateData)
        .eq("id", ticket.id);

      if (error) throw error;

      setTicket({ ...ticket, status: newStatus, resolved_at: updateData.resolved_at });
      toast({
        title: "Status atualizado",
        description: `Ticket marcado como "${statusConfig[newStatus].label}"`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const updatePriority = async (newPriority: TicketPriority) => {
    if (!ticket) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ priority: newPriority })
        .eq("id", ticket.id);

      if (error) throw error;

      setTicket({ ...ticket, priority: newPriority });
      toast({
        title: "Prioridade atualizada",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!ticket) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Ticket não encontrado</p>
          <Button asChild className="mt-4">
            <Link to="/admin/support">Voltar</Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const statusInfo = statusConfig[ticket.status];
  const priorityInfo = priorityConfig[ticket.priority];

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="mt-1">
            <Link to="/admin/support">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{ticket.subject}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
              <User className="h-3 w-3" />
              <span>{ticket.profiles?.email || "Usuário desconhecido"}</span>
              <span>•</span>
              <span>{categoryLabels[ticket.category] || ticket.category}</span>
              <span>•</span>
              <Clock className="h-3 w-3" />
              <span>
                {format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          </div>
        </div>

        {/* Status/Priority Controls */}
        <Card>
          <CardContent className="flex flex-wrap gap-4 pt-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Select
                value={ticket.status}
                onValueChange={(v) => updateStatus(v as TicketStatus)}
                disabled={updating}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="in_progress">Em Atendimento</SelectItem>
                  <SelectItem value="waiting_customer">Aguardando Cliente</SelectItem>
                  <SelectItem value="waiting_support">Aguardando Suporte</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Prioridade:</span>
              <Select
                value={ticket.priority}
                onValueChange={(v) => updatePriority(v as TicketPriority)}
                disabled={updating}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descrição do Problema</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </CardContent>
        </Card>

        {/* Messages */}
        {messages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Mensagens</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketMessages messages={messages} currentUserId={user?.id || ""} />
            </CardContent>
          </Card>
        )}

        {/* Reply Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Responder ao Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketReplyForm
              ticketId={ticket.id}
              isAdmin
              onSuccess={fetchTicket}
              disabled={["closed"].includes(ticket.status)}
            />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
