import { FileText, Image, Video, BarChart2, Play } from "lucide-react";

interface CampaignItem {
  id: string;
  item_type: "text" | "media" | "poll";
  text_content: string | null;
  media_type: "image" | "video" | "document" | "audio" | null;
  media_url: string | null;
  media_filename: string | null;
  media_caption: string | null;
  poll_question: string | null;
  poll_options: string[] | null;
  poll_allow_multiple: boolean;
  order_index: number;
  delay_after: number;
}

interface WhatsAppPreviewProps {
  items: CampaignItem[];
}

export function WhatsAppPreview({ items }: WhatsAppPreviewProps) {
  const sortedItems = [...items].sort((a, b) => a.order_index - b.order_index);

  if (sortedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <FileText className="h-6 w-6" />
        </div>
        <p className="text-sm">Adicione mensagens para ver o preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {sortedItems.map((item, index) => (
        <div key={item.id}>
          <MessageBubble item={item} />
          {item.delay_after > 0 && index < sortedItems.length - 1 && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground px-2">
                ⏱ {item.delay_after}s
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MessageBubble({ item }: { item: CampaignItem }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-lg bg-primary/10 dark:bg-primary/20 p-3 shadow-sm">
        {item.item_type === "text" && <TextMessage content={item.text_content} />}
        {item.item_type === "media" && <MediaMessage item={item} />}
        {item.item_type === "poll" && <PollMessage item={item} />}
        <div className="flex justify-end mt-1">
          <span className="text-[10px] text-muted-foreground">12:00</span>
        </div>
      </div>
    </div>
  );
}

function TextMessage({ content }: { content: string | null }) {
  return (
    <p className="text-sm whitespace-pre-wrap break-words">
      {content || <span className="text-muted-foreground italic">Mensagem vazia</span>}
    </p>
  );
}

function MediaMessage({ item }: { item: CampaignItem }) {
  const getMediaIcon = () => {
    switch (item.media_type) {
      case "image":
        return <Image className="h-8 w-8" />;
      case "video":
        return <Video className="h-8 w-8" />;
      case "document":
        return <FileText className="h-8 w-8" />;
      case "audio":
        return <Play className="h-8 w-8" />;
      default:
        return <FileText className="h-8 w-8" />;
    }
  };

  const getMediaLabel = () => {
    switch (item.media_type) {
      case "image":
        return "Imagem";
      case "video":
        return "Vídeo";
      case "document":
        return "Documento";
      case "audio":
        return "Áudio";
      default:
        return "Mídia";
    }
  };

  return (
    <div className="space-y-2">
      {item.media_url ? (
        item.media_type === "image" ? (
          <img
            src={item.media_url}
            alt="Preview"
            className="rounded-lg max-h-48 w-full object-cover"
          />
        ) : item.media_type === "video" ? (
          <video
            src={item.media_url}
            className="rounded-lg max-h-48 w-full object-cover"
            controls
          />
        ) : (
          <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
            {getMediaIcon()}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {item.media_filename || "Arquivo"}
              </p>
              <p className="text-xs text-muted-foreground">{getMediaLabel()}</p>
            </div>
          </div>
        )
      ) : (
        <div className="flex items-center gap-3 p-6 bg-muted/50 rounded-lg justify-center">
          {getMediaIcon()}
          <span className="text-sm text-muted-foreground">
            {getMediaLabel()} não selecionado
          </span>
        </div>
      )}
      {item.media_caption && (
        <p className="text-sm whitespace-pre-wrap break-words">{item.media_caption}</p>
      )}
    </div>
  );
}

function PollMessage({ item }: { item: CampaignItem }) {
  const options = item.poll_options || [];

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <BarChart2 className="h-4 w-4 mt-0.5 text-primary" />
        <p className="text-sm font-medium">
          {item.poll_question || (
            <span className="text-muted-foreground italic">Pergunta da enquete</span>
          )}
        </p>
      </div>
      <div className="space-y-1.5">
        {options.length > 0 ? (
          options.map((option, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-2 bg-background/50 rounded-md text-sm"
            >
              <div className="w-4 h-4 rounded-full border-2 border-primary/50 flex-shrink-0" />
              <span className="truncate">{option}</span>
            </div>
          ))
        ) : (
          <div className="p-2 bg-muted/50 rounded-md text-sm text-muted-foreground italic text-center">
            Adicione opções à enquete
          </div>
        )}
      </div>
      {item.poll_allow_multiple && (
        <p className="text-xs text-muted-foreground">
          ✓ Múltiplas respostas permitidas
        </p>
      )}
    </div>
  );
}
