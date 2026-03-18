import { 
  Link as LinkIcon, 
  Megaphone, 
  FolderOpen, 
  Smartphone, 
  Settings2, 
  Plug, 
  BarChart3,
  Clock
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: LinkIcon,
    title: "Links Inteligentes",
    benefit: "Distribua leads automaticamente entre grupos e nunca perca uma venda por grupo lotado",
    highlight: "Distribuição automática",
  },
  {
    icon: Megaphone,
    title: "Campanhas em Massa",
    benefit: "Envie promoções para 50 grupos em 1 clique. Economia de 3 horas por dia no mínimo.",
    highlight: "3h/dia economizadas",
  },
  {
    icon: FolderOpen,
    title: "Gestão Centralizada",
    benefit: "Todos os seus grupos em um painel. Veja quem entrou, quem saiu, quem está ativo.",
    highlight: "Controle total",
  },
  {
    icon: Smartphone,
    title: "Múltiplas Instâncias",
    benefit: "Conecte vários números de WhatsApp e gerencie tudo de um só lugar. Ideal para agências.",
    highlight: "Vários números",
  },
  {
    icon: Settings2,
    title: "Ações em Grupo",
    benefit: "Mude nome, foto e descrição de todos os grupos de uma vez. Rebranding em segundos.",
    highlight: "Alterações em massa",
  },
  {
    icon: Plug,
    title: "Integração Evolution API",
    benefit: "Conexão estável e segura, sem risco de bloqueio. Tecnologia de ponta.",
    highlight: "Conexão segura",
  },
  {
    icon: BarChart3,
    title: "Relatórios Completos",
    benefit: "Saiba exatamente quantos leads entraram, de onde vieram e quais campanhas convertem mais.",
    highlight: "Dados em tempo real",
  },
  {
    icon: Clock,
    title: "Agendamento",
    benefit: "Programe campanhas para horários estratégicos. Envie às 19h mesmo que você esteja dormindo.",
    highlight: "Automação total",
  },
];

export function FeaturesSection() {
  return (
    <section id="recursos" className="py-20">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Tudo que você precisa para{" "}
            <span className="text-gradient">dominar o WhatsApp</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Funcionalidades pensadas para quem quer escalar vendas de verdade
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={feature.title}
              className="group hover:shadow-xl hover:shadow-primary/5 hover:border-primary/50 transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="inline-block bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded mb-3">
                  {feature.highlight}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.benefit}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
