import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Download, FileText, Image, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
}

interface Message {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  user_id: string;
  attachments?: Attachment[];
}

interface TicketMessagesProps {
  messages: Message[];
  currentUserId: string;
}

export function TicketMessages({ messages, currentUserId }: TicketMessagesProps) {
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {messages.map((msg) => {
        const isOwnMessage = msg.user_id === currentUserId;
        const isAdmin = msg.is_admin;

        return (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3",
              isOwnMessage && "flex-row-reverse"
            )}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className={cn(
                "text-xs",
                isAdmin ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
              )}>
                {isAdmin ? <Shield className="h-4 w-4" /> : "U"}
              </AvatarFallback>
            </Avatar>

            <div className={cn(
              "flex-1 max-w-[80%] space-y-2",
              isOwnMessage && "flex flex-col items-end"
            )}>
              <div className={cn(
                "rounded-lg p-3",
                isAdmin
                  ? "bg-destructive/10 border border-destructive/20"
                  : isOwnMessage
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
              )}>
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
              </div>

              {msg.attachments && msg.attachments.length > 0 && (
                <div className="space-y-2">
                  {msg.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg border bg-background",
                        isOwnMessage && "ml-auto"
                      )}
                    >
                      {attachment.mime_type.startsWith("image/") ? (
                        <a
                          href={attachment.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={attachment.file_url}
                            alt={attachment.file_name}
                            className="max-w-[200px] max-h-[150px] rounded object-cover"
                          />
                        </a>
                      ) : (
                        <>
                          <div className="h-8 w-8 flex items-center justify-center bg-muted rounded">
                            {getFileIcon(attachment.mime_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.file_size)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <a href={attachment.file_url} download={attachment.file_name}>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className={cn(
                "text-xs text-muted-foreground",
                isOwnMessage && "text-right"
              )}>
                {isAdmin && <span className="text-destructive font-medium mr-1">Suporte</span>}
                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
