import { 
  Link as LinkIcon, 
  Users, 
  Megaphone, 
  Settings, 
  Smartphone, 
  BarChart3,
  CheckCircle2
} from "lucide-react";

const solutions = [
  {
    icon: LinkIcon,
    title: "Entrada automática via links inteligentes",
    description: "Leads entram sozinhos no grupo certo, sem você fazer nada",
  },
  {
    icon: Users,
    title: "Distribuição entre múltiplos grupos",
    description: "Equilibre membros automaticamente e nunca mais tenha grupo lotado",
  },
  {
    icon: Megaphone,
    title: "Campanhas em massa com 1 clique",
    description: "Envie a mesma mensagem para 50 grupos em segundos",
  },
  {
    icon: Settings,
    title: "Controle total de todos os grupos",
    description: "Veja quem entrou, quem saiu, altere nome e foto de uma vez",
  },
  {
    icon: Smartphone,
    title: "Múltiplas instâncias de WhatsApp",
    description: "Gerencie vários números em um só painel",
  },
  {
    icon: BarChart3,
    title: "Relatórios em tempo real",
    description: "Saiba exatamente quantos leads entraram e de onde vieram",
  },
];

export function SolutionSection() {
  return (
    <section className="py-20">
      <div className="container">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <CheckCircle2 className="h-4 w-4" />
            <span>A solução completa</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            O VIPSend resolve tudo isso com{" "}
            <span className="text-gradient">automação inteligente</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Uma plataforma completa para gestão profissional de grupos WhatsApp. 
            Conecte, organize, distribua e escale – tudo no piloto automático.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {solutions.map((solution, index) => (
            <div 
              key={solution.title}
              className="group bg-card border rounded-xl p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <solution.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{solution.title}</h3>
              <p className="text-muted-foreground">{solution.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
