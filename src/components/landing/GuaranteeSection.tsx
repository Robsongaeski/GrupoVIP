import { Shield, CreditCard, Clock, RefreshCcw } from "lucide-react";
import { AnimatedSection } from "@/components/ui/animated-section";

const guarantees = [
  {
    icon: CreditCard,
    title: "Sem cartão de crédito",
    description: "Comece grátis sem precisar cadastrar forma de pagamento",
  },
  {
    icon: Clock,
    title: "7 dias para testar",
    description: "Se fizer upgrade e não gostar, devolvemos 100% do valor",
  },
  {
    icon: RefreshCcw,
    title: "Cancele quando quiser",
    description: "Sem multa, sem burocracia, sem perguntas",
  },
];

export function GuaranteeSection() {
  return (
    <section className="py-20 overflow-hidden">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection animation="scale-up">
            <div className="bg-card border rounded-2xl p-8 lg:p-12 text-center relative overflow-hidden">
              {/* Subtle background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary))_1px,transparent_1px)] bg-[length:24px_24px]" />
              </div>

              <AnimatedSection animation="bounce-in" delay={200}>
                <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6 animate-float shadow-lg shadow-primary/30">
                  <Shield className="h-10 w-10 text-primary-foreground" />
                </div>
              </AnimatedSection>
              
              <AnimatedSection animation="fade-up" delay={400}>
                <h2 className="text-3xl font-bold mb-4">
                  Teste sem nenhum risco
                </h2>
              </AnimatedSection>

              <AnimatedSection animation="fade-up" delay={500}>
                <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
                  Comece com o plano grátis e use o tempo que quiser. Se decidir fazer upgrade, 
                  tem 7 dias para experimentar e receber reembolso total se não ficar satisfeito.
                </p>
              </AnimatedSection>

              <div className="grid sm:grid-cols-3 gap-8 relative z-10">
                {guarantees.map((guarantee, index) => (
                  <AnimatedSection
                    key={guarantee.title}
                    animation="fade-up"
                    delay={600 + (index * 150)}
                  >
                    <div className="text-center group">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                        <guarantee.icon className="h-6 w-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                      </div>
                      <h3 className="font-semibold mb-2">{guarantee.title}</h3>
                      <p className="text-sm text-muted-foreground">{guarantee.description}</p>
                    </div>
                  </AnimatedSection>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
