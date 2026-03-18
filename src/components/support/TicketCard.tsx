import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type TicketStatus = "open" | "in_progress" | "waiting_customer" | "waiting_support" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface TicketCardProps {
  id: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  hasUnread?: boolean;
  isAdmin?: boolean;
  userEmail?: string;
}

const statusConfig: Record<TicketStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Aberto", variant: "default" },
  in_progress: { label: "Em Atendimento", variant: "secondary" },
  waiting_customer: { label: "Aguardando Você", variant: "destructive" },
  waiting_support: { label: "Aguardando Suporte", variant: "outline" },
  resolved: { label: "Resolvido", variant: "secondary" },
  closed: { label: "Fechado", variant: "outline" },
};

const priorityConfig: Record<TicketPriority, { label: string; className: string }> = {
  low: { label: "Baixa", className: "text-muted-foreground" },
  medium: { label: "Média", className: "text-foreground" },
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

export function TicketCard({
  id,
  subject,
  category,
  status,
  priority,
  createdAt,
  updatedAt,
  hasUnread = false,
  isAdmin = false,
  userEmail,
}: TicketCardProps) {
  const statusInfo = statusConfig[status];
  const priorityInfo = priorityConfig[priority];
  const linkPath = isAdmin ? `/admin/support/${id}` : `/dashboard/support/${id}`;

  return (
    <Link to={linkPath}>
      <Card className={cn(
        "transition-all hover:shadow-md hover:border-primary/50",
        hasUnread && "border-primary ring-1 ring-primary/20"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {hasUnread && (
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
                <h3 className="font-medium truncate">{subject}</h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{categoryLabels[category] || category}</span>
                {isAdmin && userEmail && (
                  <>
                    <span>•</span>
                    <span className="truncate">{userEmail}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              <span className={cn("text-xs font-medium", priorityInfo.className)}>
                {priority === "urgent" && <AlertCircle className="h-3 w-3 inline mr-1" />}
                {priorityInfo.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Criado {formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: ptBR })}</span>
            </div>
            {updatedAt !== createdAt && (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                <span>Atualizado {formatDistanceToNow(new Date(updatedAt), { addSuffix: true, locale: ptBR })}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
