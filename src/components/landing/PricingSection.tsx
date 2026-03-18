import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { AnimatedSection } from "@/components/ui/animated-section";

const plans = [
  {
    name: "Grátis",
    subtitle: "Perfeito para testar e começar",
    price: "R$ 0",
    period: "/mês",
    features: [
      "1 instância WhatsApp",
      "3 grupos",
      "Links básicos",
      "Campanhas limitadas",
      "Suporte por email",
    ],
    cta: "Começar Grátis",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Starter",
    subtitle: "Ideal para negócios em crescimento",
    price: "R$ 49,90",
    period: "/mês",
    features: [
      "2 instâncias WhatsApp",
      "10 grupos",
      "Links inteligentes ilimitados",
      "Campanhas em massa",
      "Relatórios básicos",
      "Suporte prioritário",
    ],
    cta: "Escolher Starter",
    variant: "default" as const,
    popular: true,
  },
  {
    name: "Professional",
    subtitle: "Para quem quer escala máxima",
    price: "R$ 99,90",
    period: "/mês",
    features: [
      "5 instâncias WhatsApp",
      "50 grupos",
      "Tudo do Starter +",
      "Relatórios avançados",
      "Ações em grupo (nome/foto/descrição)",
      "API de integração",
      "Suporte VIP",
    ],
    cta: "Escolher Professional",
    variant: "outline" as const,
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section id="precos" className="py-20 bg-muted/30 overflow-hidden">
      <div className="container">
        <AnimatedSection animation="fade-up" className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Escolha o plano ideal para o{" "}
            <span className="text-gradient">tamanho do seu negócio</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comece grátis. Faça upgrade quando precisar. Cancele quando quiser.
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-start">
          {plans.map((plan, index) => (
            <AnimatedSection
              key={plan.name}
              animation={plan.popular ? "scale-up" : "fade-up"}
              delay={plan.popular ? 300 : index * 150}
            >
              <Card 
                className={`relative transition-all duration-500 group ${
                  plan.popular 
                    ? 'border-primary shadow-lg shadow-primary/10 md:scale-105 z-10 hover:shadow-xl hover:shadow-primary/20' 
                    : 'hover:border-primary/50 hover:shadow-xl hover:-translate-y-2'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-1 gradient-primary text-primary-foreground text-sm font-medium px-4 py-1.5 rounded-full shadow-lg animate-pulse-glow">
                      <Sparkles className="h-4 w-4 animate-wiggle" />
                      Mais Popular
                    </div>
                  </div>
                )}
                
                <CardHeader className="text-center pb-2">
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.subtitle}</p>
                </CardHeader>

                <CardContent className="pt-4">
                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li 
                        key={feature} 
                        className="flex items-start gap-3 opacity-0 animate-fade-in"
                        style={{ animationDelay: `${(index * 150) + (featureIndex * 50) + 300}ms`, animationFillMode: 'forwards' }}
                      >
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to={`/cadastro?plan=${plan.name.toLowerCase()}`} className="block">
                    <Button 
                      className={`w-full transition-all duration-300 ${
                        plan.popular 
                          ? 'hover:scale-105 hover:shadow-lg' 
                          : 'group-hover:bg-primary group-hover:text-primary-foreground'
                      }`}
                      variant={plan.variant}
                      size="lg"
                    >
                      {plan.cta}
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
