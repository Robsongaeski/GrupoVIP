import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TicketMessages } from "@/components/support/TicketMessages";
import { TicketReplyForm } from "@/components/support/TicketReplyForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CheckCircle, Clock, Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTicketNotifications } from "@/hooks/useTicketNotifications";
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
  waiting_customer: { label: "Aguardando Você", variant: "destructive" },
  waiting_support: { label: "Aguardando Suporte", variant: "outline" },
  resolved: { label: "Resolvido", variant: "secondary" },
  closed: { label: "Fechado", variant: "outline" },
};

const categoryLabels: Record<string, string> = {
  technical: "Dúvida Técnica",
  campaign: "Problema com Campanha",
  instance: "Problema com Instância",
  billing: "Cobrança/Pagamento",
  feedback: "Sugestão/Feedback",
  other: "Outro",
};

export default function SupportTicket() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { markTicketAsRead } = useTicketNotifications();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reopening, setReopening] = useState(false);
  const [closing, setClosing] = useState(false);

  const fetchTicket = async () => {
    if (!id || !user) return;

    try {
      // Buscar ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (ticketError) throw ticketError;
      setTicket(ticketData);

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

      // Marcar notificações como lidas
      markTicketAsRead(id);
    } catch (error) {
      console.error("Erro ao buscar ticket:", error);
      toast({
        title: "Erro",
        description: "Ticket não encontrado",
        variant: "destructive",
      });
      navigate("/dashboard/support");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [id, user]);

  const handleReopen = async () => {
    if (!ticket) return;

    setReopening(true);
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "open", resolved_at: null })
        .eq("id", ticket.id);

      if (error) throw error;

      setTicket({ ...ticket, status: "open", resolved_at: null });
      toast({
        title: "Ticket reaberto",
        description: "Você pode continuar a conversa",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setReopening(false);
    }
  };

  const handleClose = async () => {
    if (!ticket) return;

    setClosing(true);
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "closed", resolved_at: new Date().toISOString() })
        .eq("id", ticket.id);

      if (error) throw error;

      setTicket({ ...ticket, status: "closed", resolved_at: new Date().toISOString() });
      toast({
        title: "Ticket encerrado",
        description: "O ticket foi fechado com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!ticket) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Ticket não encontrado</p>
          <Button asChild className="mt-4">
            <Link to="/dashboard/support">Voltar</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const statusInfo = statusConfig[ticket.status];
  const isClosed = ["resolved", "closed"].includes(ticket.status);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard/support">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{ticket.subject}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{categoryLabels[ticket.category] || ticket.category}</span>
              <span>•</span>
              <Clock className="h-3 w-3" />
              <span>
                Criado em {format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          </div>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descrição</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </CardContent>
        </Card>

        {/* Messages */}
        {messages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversas</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketMessages messages={messages} currentUserId={user?.id || ""} />
            </CardContent>
          </Card>
        )}

        {/* Reply Form or Reopen Button */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isClosed ? "Ticket Fechado" : "Responder"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isClosed ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Este ticket foi {ticket.status === "resolved" ? "resolvido" : "fechado"}.
                  {ticket.resolved_at && (
                    <span className="block mt-1">
                      Em {format(new Date(ticket.resolved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </p>
                <Button onClick={handleReopen} disabled={reopening}>
                  {reopening && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reabrir Ticket
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <TicketReplyForm
                  ticketId={ticket.id}
                  onSuccess={fetchTicket}
                />
                <Separator />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={closing}
                  >
                    {closing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Encerrar Ticket
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
