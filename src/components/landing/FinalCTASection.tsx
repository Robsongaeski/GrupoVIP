import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";
import { AnimatedSection } from "@/components/ui/animated-section";

export function FinalCTASection() {
  return (
    <section className="py-20 lg:py-32 gradient-primary relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 -z-0">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full animate-float"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + i * 0.5}s`,
            }}
          />
        ))}
      </div>

      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <AnimatedSection animation="bounce-in">
            <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium mb-8 backdrop-blur-sm animate-pulse">
              <Zap className="h-4 w-4" />
              <span>Cada dia sem automação é dinheiro perdido</span>
            </div>
          </AnimatedSection>

          <AnimatedSection animation="fade-up" delay={200}>
            <h2 className="text-3xl lg:text-5xl font-bold text-primary-foreground mb-6">
              Comece hoje a transformar seus grupos em uma máquina de vendas
            </h2>
          </AnimatedSection>
          
          <AnimatedSection animation="fade-up" delay={400}>
            <p className="text-xl text-primary-foreground/80 mb-10">
              Milhares de leads estão esperando. Enquanto você lê isso, 
              seus concorrentes já estão automatizando.
            </p>
          </AnimatedSection>

          <AnimatedSection animation="scale-up" delay={600}>
            <Link to="/cadastro">
              <Button 
                size="lg" 
                variant="secondary" 
                className="text-lg px-10 py-7 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 animate-pulse-glow group"
              >
                Criar Minha Conta Grátis
                <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-2" />
              </Button>
            </Link>
          </AnimatedSection>

          <AnimatedSection animation="fade-up" delay={800}>
            <p className="mt-6 text-primary-foreground/60 text-sm">
              Configuração em 2 minutos • Sem cartão de crédito • Cancele quando quiser
            </p>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
