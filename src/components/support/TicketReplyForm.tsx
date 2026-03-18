import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileUploader, FileWithPreview } from "./FileUploader";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";

interface TicketReplyFormProps {
  ticketId: string;
  isAdmin?: boolean;
  onSuccess?: () => void;
  disabled?: boolean;
}

export function TicketReplyForm({
  ticketId,
  isAdmin = false,
  onSuccess,
  disabled = false,
}: TicketReplyFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !message.trim()) return;

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
      // 1. Criar a mensagem
      const { data: newMessage, error: messageError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          message: message.trim(),
          is_admin: isAdmin,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // 2. Upload dos arquivos (se houver)
      if (files.length > 0) {
        for (const fileItem of files) {
          const filePath = `${user.id}/${ticketId}/${Date.now()}_${fileItem.file.name}`;
          
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
            ticket_id: ticketId,
            message_id: newMessage.id,
            file_name: fileItem.file.name,
            file_url: urlData.publicUrl,
            file_size: fileItem.file.size,
            mime_type: fileItem.file.type,
            uploaded_by: user.id,
          });
        }
      }

      setMessage("");
      setFiles([]);
      onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={isAdmin ? "Digite sua resposta..." : "Digite sua mensagem..."}
        rows={3}
        disabled={disabled || loading}
        maxLength={5000}
      />

      <FileUploader
        files={files}
        onFilesChange={setFiles}
        maxFiles={3}
        disabled={disabled || loading}
      />

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={disabled || loading || !message.trim()}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Enviar
        </Button>
      </div>
    </form>
  );
}
