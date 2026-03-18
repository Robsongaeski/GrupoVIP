import { Link } from "react-router-dom";
import logoVipsend from "@/assets/logo-vipsend-light.jpg";

export function Footer() {
  return (
    <footer className="py-12 border-t bg-muted/30">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img src={logoVipsend} alt="VIPSend" className="h-14 w-auto rounded-lg" />
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Termos de Uso
            </Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacidade
            </Link>
            <a href="mailto:contato@vipsend.com.br" className="hover:text-foreground transition-colors">
              Contato
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} VIPSend. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
