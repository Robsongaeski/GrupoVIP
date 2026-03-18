import { Check, X } from "lucide-react";
import { AnimatedSection } from "@/components/ui/animated-section";

const comparisons = [
  {
    aspect: "Tempo gasto por dia",
    manual: "4+ horas",
    vipsend: "15 minutos",
  },
  {
    aspect: "Distribuição de leads",
    manual: "Caos e grupos lotados",
    vipsend: "Automática e equilibrada",
  },
  {
    aspect: "Envio de campanhas",
    manual: "Copiar/colar grupo por grupo",
    vipsend: "1 clique para todos",
  },
  {
    aspect: "Risco de bloqueio",
    manual: "Alto (comportamento suspeito)",
    vipsend: "Mínimo (via Evolution API)",
  },
  {
    aspect: "Controle de membros",
    manual: "Nenhum",
    vipsend: "Total e em tempo real",
  },
  {
    aspect: "Escalabilidade",
    manual: "Limitada ao seu tempo",
    vipsend: "Ilimitada",
  },
  {
    aspect: "Relatórios e métricas",
    manual: "Inexistentes",
    vipsend: "Completos e detalhados",
  },
  {
    aspect: "Investimento",
    manual: "Seu tempo (vale R$X/hora)",
    vipsend: "A partir de R$0/mês",
  },
];

export function ComparisonSection() {
  return (
    <section className="py-20 bg-muted/30 overflow-hidden">
      <div className="container">
        <AnimatedSection animation="fade-up" className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            WhatsApp Manual{" "}
            <span className="text-muted-foreground">vs</span>{" "}
            <span className="text-gradient">VIPSend</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Veja a diferença entre continuar perdendo tempo e começar a escalar
          </p>
        </AnimatedSection>

        <div className="max-w-4xl mx-auto">
          <AnimatedSection animation="scale-up" delay={200}>
            <div className="bg-card rounded-2xl border overflow-hidden shadow-lg">
              {/* Header */}
              <div className="grid grid-cols-3 bg-muted/50">
                <div className="p-4 lg:p-6 font-semibold text-muted-foreground">
                  Aspecto
                </div>
                <div className="p-4 lg:p-6 font-semibold text-center border-x bg-destructive/5 text-destructive">
                  <X className="h-5 w-5 mx-auto mb-1 animate-wiggle" />
                  Manual
                </div>
                <div className="p-4 lg:p-6 font-semibold text-center bg-primary/5 text-primary">
                  <Check className="h-5 w-5 mx-auto mb-1 animate-bounce-in" />
                  VIPSend
                </div>
              </div>

              {/* Rows with staggered animation */}
              {comparisons.map((row, index) => (
                <div 
                  key={row.aspect}
                  className={`grid grid-cols-3 opacity-0 animate-fade-in transition-colors duration-300 hover:bg-muted/40 ${
                    index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                  }`}
                  style={{ 
                    animationDelay: `${300 + (index * 100)}ms`,
                    animationFillMode: 'forwards'
                  }}
                >
                  <div className="p-4 lg:p-6 font-medium text-sm lg:text-base">
                    {row.aspect}
                  </div>
                  <div className="p-4 lg:p-6 text-center border-x text-sm lg:text-base text-destructive/80 bg-destructive/5">
                    {row.manual}
                  </div>
                  <div className="p-4 lg:p-6 text-center text-sm lg:text-base text-primary font-medium bg-primary/5">
                    {row.vipsend}
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
