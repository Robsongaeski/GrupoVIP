import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Smartphone, Link as LinkIcon, Rocket, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Smartphone,
    title: "Conecte seu WhatsApp",
    description: "Escaneie o QR Code e sincronize sua conta em segundos. Simples como usar o WhatsApp Web.",
  },
  {
    number: "02",
    icon: LinkIcon,
    title: "Crie links inteligentes",
    description: "Configure a distribuição automática entre seus grupos. Defina prioridades e limites.",
  },
  {
    number: "03",
    icon: Rocket,
    title: "Lance campanhas e escale",
    description: "Envie mensagens para todos os grupos e acompanhe os resultados em tempo real.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-20 bg-muted/30">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Comece a automatizar em{" "}
            <span className="text-gradient">3 passos simples</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Não precisa ser técnico. Não precisa de desenvolvedor. Configure tudo em minutos.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-16 left-[16.66%] right-[16.66%] h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
            
            {steps.map((step, index) => (
              <div key={step.number} className="relative text-center">
                {/* Step number circle */}
                <div className="relative z-10 w-32 h-32 mx-auto mb-6">
                  <div className="absolute inset-0 gradient-primary rounded-full opacity-20" />
                  <div className="absolute inset-2 bg-card rounded-full flex items-center justify-center border-2 border-primary">
                    <step.icon className="h-12 w-12 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {step.number}
                  </div>
                </div>
                
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/auth">
              <Button size="lg" className="text-lg px-8 py-6 shadow-lg shadow-primary/25">
                Começar agora – é grátis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
