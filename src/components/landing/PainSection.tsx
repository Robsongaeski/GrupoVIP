import { 
  UserX, 
  FolderX, 
  Clock, 
  Copy, 
  AlertTriangle, 
  BarChart3 
} from "lucide-react";

const painPoints = [
  {
    icon: UserX,
    title: "Leads perdidos",
    description: "Pessoas clicam no link e caem em grupo lotado ou errado. Venda perdida.",
  },
  {
    icon: FolderX,
    title: "Grupos desorganizados",
    description: "Sem controle de quem entra, quem sai, quem está ativo. Caos total.",
  },
  {
    icon: Clock,
    title: "Trabalho manual infinito",
    description: "Adicionar, remover, responder... um por um. Seu tempo vale dinheiro.",
  },
  {
    icon: Copy,
    title: "Campanhas uma a uma",
    description: "Copiar e colar a mesma mensagem em 10, 20, 50 grupos. Todo. Santo. Dia.",
  },
  {
    icon: AlertTriangle,
    title: "Risco de bloqueio",
    description: "Enviar muitas mensagens manualmente = conta suspensa. Negócio parado.",
  },
  {
    icon: BarChart3,
    title: "Zero métricas",
    description: "Não sabe quantas pessoas entraram, clicaram ou converteram. Decisões no escuro.",
  },
];

export function PainSection() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Você ainda gerencia grupos de WhatsApp{" "}
            <span className="text-destructive">assim?</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Se você se identificou com algum desses problemas, está perdendo dinheiro todo dia.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {painPoints.map((pain, index) => (
            <div 
              key={pain.title}
              className="group bg-card border border-destructive/20 rounded-xl p-6 hover:border-destructive/40 hover:shadow-lg hover:shadow-destructive/5 transition-all"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4 group-hover:bg-destructive/20 transition-colors">
                <pain.icon className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{pain.title}</h3>
              <p className="text-muted-foreground">{pain.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
