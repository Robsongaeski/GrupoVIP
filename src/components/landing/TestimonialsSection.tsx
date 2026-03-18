import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AnimatedSection } from "@/components/ui/animated-section";

const testimonials = [
  {
    name: "Ricardo M.",
    role: "Dono de Loja Virtual",
    avatar: "RM",
    rating: 5,
    text: "Antes eu perdia horas adicionando pessoas em grupos manualmente. Com o VIPSend, os leads entram sozinhos pelo link inteligente e já caem no grupo certo. Minhas vendas aumentaram 40% no primeiro mês.",
  },
  {
    name: "Camila S.",
    role: "Infoprodutora",
    avatar: "CS",
    rating: 5,
    text: "Uso para meus lançamentos. Consigo enviar a mesma mensagem para 30 grupos de alunos em segundos. O que levava 2 horas, agora faço em 2 minutos. Ferramenta essencial para quem escala.",
  },
  {
    name: "Fernando L.",
    role: "Agência Digital",
    avatar: "FL",
    rating: 5,
    text: "Gerenciamos os grupos de 15 clientes diferentes. Com múltiplas instâncias, cada cliente tem seu WhatsApp separado e conseguimos escalar sem virar um caos. Recomendo demais.",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-20 overflow-hidden">
      <div className="container">
        <AnimatedSection animation="fade-up" className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            O que nossos clientes{" "}
            <span className="text-gradient">dizem</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Resultados reais de quem já automatizou seus grupos
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <AnimatedSection
              key={testimonial.name}
              animation="fade-up"
              delay={index * 150}
            >
              <Card 
                className="relative h-full group hover:shadow-xl hover:-translate-y-2 transition-all duration-500 hover:border-primary/30"
              >
                <CardContent className="p-6">
                  {/* Quote icon with animation */}
                  <Quote className="h-8 w-8 text-primary/20 absolute top-4 right-4 transition-transform duration-300 group-hover:scale-110 group-hover:text-primary/40" />
                  
                  {/* Rating with staggered fill animation */}
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star 
                        key={i} 
                        className="h-5 w-5 fill-warning text-warning transition-transform duration-300"
                        style={{ 
                          animationDelay: `${(index * 150) + (i * 100)}ms`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Text */}
                  <p className="text-muted-foreground mb-6 relative z-10">
                    "{testimonial.text}"
                  </p>

                  {/* Author with hover effect */}
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 bg-primary/10 transition-transform duration-300 group-hover:scale-110">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {testimonial.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
