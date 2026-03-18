import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import logoVipsend from "@/assets/logo-vipsend-light.jpg";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 100);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        isScrolled 
          ? "bg-background/95 backdrop-blur-md shadow-lg border-b" 
          : "bg-transparent",
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <div 
          className={cn(
            "flex items-center gap-3 transition-all duration-500 delay-100",
            isVisible ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0"
          )}
        >
          <div className="bg-white rounded-lg p-3 shadow-md">
            <img src={logoVipsend} alt="VIPSend" className="h-12 w-auto" />
          </div>
        </div>
        
        <nav 
          className={cn(
            "hidden md:flex items-center gap-8 transition-all duration-500 delay-200",
            isVisible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
          )}
        >
          <a 
            href="#como-funciona" 
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors animated-underline"
          >
            Como Funciona
          </a>
          <a 
            href="#recursos" 
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors animated-underline"
          >
            Recursos
          </a>
          <a 
            href="#precos" 
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors animated-underline"
          >
            Preços
          </a>
        </nav>

        <div 
          className={cn(
            "flex items-center gap-3 transition-all duration-500 delay-300",
            isVisible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
          )}
        >
          <Link to="/login">
            <Button 
              variant="ghost" 
              size="sm"
              className="transition-all duration-300 hover:bg-primary/10"
            >
              Entrar
            </Button>
          </Link>
          <Link to="/cadastro">
            <Button 
              size="sm" 
              className="shadow-lg shadow-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 btn-arrow"
            >
              Criar Conta Grátis
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
