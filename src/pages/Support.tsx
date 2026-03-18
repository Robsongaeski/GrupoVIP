import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TicketCard } from "@/components/support/TicketCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, HelpCircle, Loader2 } from "lucide-react";
import { useTicketNotifications } from "@/hooks/useTicketNotifications";

type TicketStatus = "open" | "in_progress" | "waiting_customer" | "waiting_support" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
}

export default function Support() {
  const { user } = useAuth();
  const { notifications } = useTicketNotifications();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;

    const fetchTickets = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("support_tickets")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter as TicketStatus);
        }

        const { data, error } = await query;

        if (error) throw error;
        setTickets((data as Ticket[]) || []);
      } catch (error) {
        console.error("Erro ao buscar tickets:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [user, statusFilter]);

  const filteredTickets = tickets.filter((ticket) =>
    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasUnreadNotification = (ticketId: string) => {
    return notifications.some((n) => n.ticket_id === ticketId && !n.read);
  };

  const openTickets = tickets.filter(
    (t) => !["resolved", "closed"].includes(t.status)
  ).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="h-6 w-6" />
              Ajuda & Suporte
            </h1>
            <p className="text-muted-foreground">
              Abra um ticket para tirar dúvidas ou reportar problemas
            </p>
          </div>
          <Button asChild>
            <Link to="/dashboard/support/new">
              <Plus className="mr-2 h-4 w-4" />
              Novo Ticket
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{tickets.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Em Aberto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{openTickets}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aguardando Resposta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">
                {tickets.filter((t) => t.status === "waiting_customer").length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="in_progress">Em Atendimento</SelectItem>
              <SelectItem value="waiting_customer">Aguardando Você</SelectItem>
              <SelectItem value="waiting_support">Aguardando Suporte</SelectItem>
              <SelectItem value="resolved">Resolvidos</SelectItem>
              <SelectItem value="closed">Fechados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Ticket List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Nenhum ticket encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all"
                  ? "Tente ajustar os filtros"
                  : "Abra seu primeiro ticket de suporte"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button asChild>
                  <Link to="/dashboard/support/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Ticket
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                id={ticket.id}
                subject={ticket.subject}
                category={ticket.category}
                status={ticket.status}
                priority={ticket.priority}
                createdAt={ticket.created_at}
                updatedAt={ticket.updated_at}
                hasUnread={hasUnreadNotification(ticket.id)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
