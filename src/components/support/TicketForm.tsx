import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploader, FileWithPreview } from "./FileUploader";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const categories = [
  { value: "technical", label: "Dúvida Técnica" },
  { value: "campaign", label: "Problema com Campanha" },
  { value: "instance", label: "Problema com Instância" },
  { value: "billing", label: "Cobrança/Pagamento" },
  { value: "feedback", label: "Sugestão/Feedback" },
  { value: "other", label: "Outro" },
];

interface TicketFormProps {
  onSuccess?: () => void;
}

export function TicketForm({ onSuccess }: TicketFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validar arquivos
    const invalidFiles = files.filter((f) => f.error);
    if (invalidFiles.length > 0) {
      toast({
        title: "Arquivos inválidos",
        description: "Remova os arquivos com erro antes de enviar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Criar o ticket
      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          subject,
          description,
          category,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // 2. Upload dos arquivos (se houver)
      if (files.length > 0) {
        for (const fileItem of files) {
          const filePath = `${user.id}/${ticket.id}/${Date.now()}_${fileItem.file.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from("support-attachments")
            .upload(filePath, fileItem.file);

          if (uploadError) {
            console.error("Erro no upload:", uploadError);
            continue;
          }

          const { data: urlData } = supabase.storage
            .from("support-attachments")
            .getPublicUrl(filePath);

          // 3. Registrar anexo no banco
          await supabase.from("ticket_attachments").insert({
            ticket_id: ticket.id,
            file_name: fileItem.file.name,
            file_url: urlData.publicUrl,
            file_size: fileItem.file.size,
            mime_type: fileItem.file.type,
            uploaded_by: user.id,
          });
        }
      }

      toast({
        title: "Ticket criado!",
        description: "Seu ticket foi enviado com sucesso. Aguarde nossa resposta.",
      });

      onSuccess?.();
      navigate(`/dashboard/support/${ticket.id}`);
    } catch (error: any) {
      console.error("Erro ao criar ticket:", error);
      toast({
        title: "Erro ao criar ticket",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="category">Categoria</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="category">
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Assunto</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Resumo do seu problema ou dúvida"
          required
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva detalhadamente seu problema ou dúvida..."
          required
          rows={6}
          maxLength={5000}
        />
      </div>

      <div className="space-y-2">
        <Label>Anexos (opcional)</Label>
        <FileUploader
          files={files}
          onFilesChange={setFiles}
          maxFiles={5}
          disabled={loading}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/dashboard/support")}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enviar Ticket
        </Button>
      </div>
    </form>
  );
}
