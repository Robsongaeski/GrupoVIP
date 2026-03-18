import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/layout/AdminLayout";
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
import { Search, Headphones, Loader2, AlertCircle } from "lucide-react";

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
  user_id: string;
  profiles?: {
    email: string;
  };
}

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("support_tickets")
          .select("*")
          .order("updated_at", { ascending: false });

        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter as TicketStatus);
        }

        if (priorityFilter !== "all") {
          query = query.eq("priority", priorityFilter as TicketPriority);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Buscar emails dos usuários separadamente
        const ticketsWithProfiles = await Promise.all(
          (data || []).map(async (ticket: any) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("email")
              .eq("id", ticket.user_id)
              .single();
            return {
              ...ticket,
              profiles: profile,
            } as Ticket;
          })
        );

        setTickets(ticketsWithProfiles);
      } catch (error) {
        console.error("Erro ao buscar tickets:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [statusFilter, priorityFilter]);

  const filteredTickets = tickets.filter(
    (ticket) =>
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCount = tickets.filter((t) => t.status === "open").length;
  const waitingCount = tickets.filter((t) => t.status === "waiting_support").length;
  const urgentCount = tickets.filter((t) => t.priority === "urgent" && !["resolved", "closed"].includes(t.status)).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Headphones className="h-6 w-6" />
            Central de Suporte
          </h1>
          <p className="text-muted-foreground">
            Gerencie os tickets de suporte dos clientes
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
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
                Novos (Abertos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{openCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aguardando Resposta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-500">{waitingCount}</p>
            </CardContent>
          </Card>
          <Card className={urgentCount > 0 ? "border-destructive" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                {urgentCount > 0 && <AlertCircle className="h-4 w-4 text-destructive" />}
                Urgentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{urgentCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por assunto ou email..."
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
              <SelectItem value="waiting_customer">Aguardando Cliente</SelectItem>
              <SelectItem value="waiting_support">Aguardando Suporte</SelectItem>
              <SelectItem value="resolved">Resolvidos</SelectItem>
              <SelectItem value="closed">Fechados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
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
              <Headphones className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Nenhum ticket encontrado</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all" || priorityFilter !== "all"
                  ? "Tente ajustar os filtros"
                  : "Não há tickets no momento"}
              </p>
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
                isAdmin
                userEmail={ticket.profiles?.email}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
