import DashboardLayout from "@/components/layout/DashboardLayout";
import { TicketForm } from "@/components/support/TicketForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

export default function SupportNew() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HelpCircle className="h-6 w-6" />
            Novo Ticket de Suporte
          </h1>
          <p className="text-muted-foreground">
            Descreva seu problema ou dúvida e nossa equipe responderá o mais rápido possível
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Abrir Ticket</CardTitle>
            <CardDescription>
              Preencha as informações abaixo para criar seu ticket de suporte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TicketForm />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
