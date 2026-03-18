import { Users, MessageCircle } from "lucide-react";

export type LinkType = "groups" | "direct_chat";

interface LinkTypeSelectorProps {
  onSelect: (type: LinkType) => void;
}

export function LinkTypeSelector({ onSelect }: LinkTypeSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Qual tipo de link você quer criar?</h2>
        <p className="text-sm text-muted-foreground">
          Escolha o tipo de redirecionamento para seu link inteligente
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onSelect("groups")}
          className="p-6 rounded-xl border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Users className="h-6 w-6" />
            </div>
            <span className="font-semibold text-lg">Grupos</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Distribui visitantes entre grupos do WhatsApp, preenchendo automaticamente os grupos com vagas.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelect("direct_chat")}
          className="p-6 rounded-xl border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <MessageCircle className="h-6 w-6" />
            </div>
            <span className="font-semibold text-lg">Conversa Direta</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Abre uma conversa no WhatsApp com um número específico, com mensagem pré-definida.
          </p>
        </button>
      </div>
    </div>
  );
}
