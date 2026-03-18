import { useState, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  GripVertical,
  Trash2,
  Type,
  Image,
  Video,
  FileText,
  BarChart2,
  Plus,
  X,
  Upload,
  Loader2,
  Music,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Smile,
  AlertTriangle,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CampaignItem {
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

interface CampaignItemEditorProps {
  item: CampaignItem;
  index: number;
  onChange: (item: CampaignItem) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  campaignId: string;
}

const EMOJI_CATEGORIES = [
  {
    label: "Frequentes",
    emojis: ["😊", "😂", "❤️", "🔥", "👍", "🎉", "✅", "⭐", "💰", "🚀", "💪", "🙏", "👏", "😍", "🤩", "💯"],
  },
  {
    label: "Rostos",
    emojis: ["😀", "😃", "😄", "😁", "😆", "🥰", "😘", "🤗", "🤔", "😎", "🤯", "😱", "😢", "😤", "🥳", "😴"],
  },
  {
    label: "Gestos",
    emojis: ["👋", "🤝", "✌️", "🤞", "👆", "👇", "👉", "👈", "💪", "🙌", "👊", "✊", "🫶", "🤙", "🖐️", "☝️"],
  },
  {
    label: "Objetos",
    emojis: ["📱", "💻", "📧", "📞", "💡", "🔔", "📢", "🏆", "🎯", "📊", "💎", "🔑", "📌", "⚡", "🛒", "🎁"],
  },
  {
    label: "Símbolos",
    emojis: ["✅", "❌", "⚠️", "ℹ️", "❓", "❗", "💲", "🔗", "📍", "⏰", "🔒", "🔓", "▶️", "⏩", "🔄", "➡️"],
  },
];

function wrapSelection(
  textarea: HTMLTextAreaElement,
  wrapper: string,
  currentValue: string,
  onChange: (value: string) => void
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = currentValue.substring(start, end);

  if (selectedText) {
    const newText =
      currentValue.substring(0, start) +
      wrapper +
      selectedText +
      wrapper +
      currentValue.substring(end);
    onChange(newText);
    // Restore cursor after wrapper
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + wrapper.length,
        end + wrapper.length
      );
    }, 0);
  } else {
    // No selection: insert wrapper pair and place cursor inside
    const newText =
      currentValue.substring(0, start) +
      wrapper + wrapper +
      currentValue.substring(end);
    onChange(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + wrapper.length, start + wrapper.length);
    }, 0);
  }
}

export function CampaignItemEditor({
  item,
  index,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  campaignId,
}: CampaignItemEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const getItemIcon = () => {
    switch (item.item_type) {
      case "text":
        return <Type className="h-4 w-4" />;
      case "media":
        return <Image className="h-4 w-4" />;
      case "poll":
        return <BarChart2 className="h-4 w-4" />;
    }
  };

  const getItemLabel = () => {
    switch (item.item_type) {
      case "text":
        return "Texto";
      case "media":
        return "Mídia";
      case "poll":
        return "Enquete";
    }
  };

  const handleFormat = (wrapper: string) => {
    if (!textareaRef.current) return;
    wrapSelection(
      textareaRef.current,
      wrapper,
      item.text_content || "",
      (val) => onChange({ ...item, text_content: val })
    );
  };

  const handleInsertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const current = item.text_content || "";
    if (textarea) {
      const start = textarea.selectionStart;
      const newText = current.substring(0, start) + emoji + current.substring(start);
      onChange({ ...item, text_content: newText });
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      onChange({ ...item, text_content: current + emoji });
    }
  };

  const handleInsertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    const current = item.text_content || "";
    if (textarea) {
      const start = textarea.selectionStart;
      const newText = current.substring(0, start) + variable + current.substring(start);
      onChange({ ...item, text_content: newText });
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      onChange({ ...item, text_content: current + variable });
    }
  };

  const compressImage = (file: File, maxWidth = 1280, quality = 0.75): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width <= maxWidth) {
          resolve(file);
          return;
        }
        const ratio = maxWidth / width;
        width = maxWidth;
        height = Math.round(height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            const compressed = new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() });
            resolve(compressed);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
      img.src = url;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = {
      image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      video: ["video/mp4", "video/webm", "video/quicktime"],
      document: ["application/pdf"],
      audio: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/mp3"],
    };

    let detectedType: "image" | "video" | "document" | "audio" | null = null;
    for (const [type, mimes] of Object.entries(allowedTypes)) {
      if (mimes.includes(file.type)) {
        detectedType = type as "image" | "video" | "document" | "audio";
        break;
      }
    }

    if (!detectedType) {
      toast.error("Tipo de arquivo não suportado");
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 10MB)");
      return;
    }

    setUploading(true);
    try {
      let fileToUpload: File = file;

      // Compress images automatically
      if (detectedType === "image" && file.type !== "image/gif") {
        const originalSize = file.size;
        fileToUpload = await compressImage(file);
        if (fileToUpload.size < originalSize) {
          const savedPct = Math.round((1 - fileToUpload.size / originalSize) * 100);
          toast.info(`Imagem comprimida automaticamente (-${savedPct}%)`);
        }
      }

      const fileExt = detectedType === "image" && file.type !== "image/gif" ? "jpg" : file.name.split(".").pop();
      const fileName = `${campaignId}/${item.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("campaign-media")
        .upload(fileName, fileToUpload, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("campaign-media")
        .getPublicUrl(fileName);

      onChange({
        ...item,
        media_type: detectedType,
        media_url: urlData.publicUrl,
        media_filename: file.name,
      });

      toast.success("Arquivo enviado com sucesso!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const addPollOption = () => {
    const options = item.poll_options || [];
    if (options.length >= 12) {
      toast.error("Máximo de 12 opções");
      return;
    }
    onChange({
      ...item,
      poll_options: [...options, ""],
    });
  };

  const updatePollOption = (optionIndex: number, value: string) => {
    const options = [...(item.poll_options || [])];
    options[optionIndex] = value;
    onChange({ ...item, poll_options: options });
  };

  const removePollOption = (optionIndex: number) => {
    const options = (item.poll_options || []).filter((_, i) => i !== optionIndex);
    onChange({ ...item, poll_options: options });
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <Card ref={setNodeRef} style={style} className="border-l-4 border-l-primary">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
            title="Arraste para reordenar"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              {getItemIcon()}
            </div>
            <span className="font-medium text-sm">
              {index + 1}. {getItemLabel()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor={`delay-${item.id}`} className="text-xs text-muted-foreground">
                Delay:
              </Label>
              <Input
                id={`delay-${item.id}`}
                type="number"
                min={0}
                max={60}
                value={item.delay_after}
                onChange={(e) =>
                  onChange({ ...item, delay_after: parseInt(e.target.value) || 0 })
                }
                className="w-14 h-7 text-xs"
              />
              <span className="text-xs text-muted-foreground">s</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-4 px-4">
        {item.item_type === "text" && (
          <div className="space-y-2">
            {/* WhatsApp Formatting Toolbar */}
            <div className="flex items-center gap-1 border rounded-t-md px-2 py-1.5 bg-muted/30 border-b-0">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleFormat("*")}
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p className="text-xs">Negrito *texto*</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleFormat("_")}
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p className="text-xs">Itálico _texto_</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleFormat("~")}
                    >
                      <Strikethrough className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p className="text-xs">Tachado ~texto~</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleFormat("```")}
                    >
                      <Code className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p className="text-xs">Monoespaçado ```texto```</p></TooltipContent>
                </Tooltip>

                <div className="w-px h-5 bg-border mx-1" />

                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                    >
                      <Smile className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2" align="start">
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {EMOJI_CATEGORIES.map((cat) => (
                        <div key={cat.label}>
                          <p className="text-xs font-medium text-muted-foreground mb-1 px-1">{cat.label}</p>
                          <div className="grid grid-cols-8 gap-0.5">
                            {cat.emojis.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted text-lg transition-colors"
                                onClick={() => {
                                  handleInsertEmoji(emoji);
                                  setEmojiOpen(false);
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="w-px h-5 bg-border mx-1" />

                {/* Variable buttons */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 px-2"
                    >
                      <span className="font-mono">{"{ }"}</span>
                      Variáveis
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="start">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Inserir variável</p>
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm transition-colors"
                          onClick={() => handleInsertVariable("{nome}")}
                        >
                          <span className="font-mono text-primary">{"{nome}"}</span>
                          <span className="text-muted-foreground ml-2">— Nome do grupo</span>
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm transition-colors"
                          onClick={() => handleInsertVariable("{data}")}
                        >
                          <span className="font-mono text-primary">{"{data}"}</span>
                          <span className="text-muted-foreground ml-2">— Data do envio</span>
                        </button>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex items-start gap-1.5">
                          <Info className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            As variáveis são substituídas automaticamente no momento do envio da campanha.
                          </p>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </TooltipProvider>
            </div>

            <Textarea
              ref={textareaRef}
              placeholder="Digite sua mensagem... Use a barra acima para formatar 😊"
              value={item.text_content || ""}
              onChange={(e) => onChange({ ...item, text_content: e.target.value })}
              rows={4}
              className="resize-none rounded-t-none border-t-0 focus-visible:ring-offset-0"
            />
          </div>
        )}

        {item.item_type === "media" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-400">
                <p className="font-medium">Cuidado com o tamanho dos arquivos</p>
                <p className="mt-0.5">Arquivos muito grandes podem prejudicar a entrega e causar falhas no envio. Imagens são comprimidas automaticamente. Para vídeos, recomendamos até 5MB.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select
                value={item.media_type || "image"}
                onValueChange={(v) =>
                  onChange({
                    ...item,
                    media_type: v as "image" | "video" | "document" | "audio",
                  })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Imagem
                    </div>
                  </SelectItem>
                  <SelectItem value="video">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Vídeo
                    </div>
                  </SelectItem>
                  <SelectItem value="document">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      PDF
                    </div>
                  </SelectItem>
                  <SelectItem value="audio">
                    <div className="flex items-center gap-2">
                      <Music className="h-4 w-4" />
                      Áudio
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1">
                <Label
                  htmlFor={`file-${item.id}`}
                  className="flex items-center justify-center gap-2 h-10 px-4 border border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">
                        {item.media_filename || "Selecionar arquivo"}
                      </span>
                    </>
                  )}
                </Label>
                <input
                  id={`file-${item.id}`}
                  type="file"
                  className="hidden"
                  accept={
                    item.media_type === "image"
                      ? "image/*"
                      : item.media_type === "video"
                      ? "video/*"
                      : item.media_type === "audio"
                      ? "audio/*"
                      : ".pdf"
                  }
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </div>
            </div>

            {item.media_url && (
              <div className="relative">
                {item.media_type === "image" && (
                  <img
                    src={item.media_url}
                    alt="Preview"
                    className="rounded-lg max-h-32 object-cover"
                  />
                )}
                {item.media_type === "video" && (
                  <video
                    src={item.media_url}
                    className="rounded-lg max-h-32"
                    controls
                  />
                )}
                {item.media_type === "audio" && (
                  <audio src={item.media_url} controls className="w-full" />
                )}
                {item.media_type === "document" && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="h-6 w-6 text-primary" />
                    <span className="text-sm truncate">{item.media_filename}</span>
                  </div>
                )}
              </div>
            )}

            <Textarea
              placeholder="Legenda (opcional)"
              value={item.media_caption || ""}
              onChange={(e) => onChange({ ...item, media_caption: e.target.value })}
              rows={2}
              className="resize-none"
            />
          </div>
        )}

        {item.item_type === "poll" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pergunta da Enquete</Label>
              <Input
                placeholder="Qual sua cor favorita?"
                value={item.poll_question || ""}
                onChange={(e) => onChange({ ...item, poll_question: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Opções ({(item.poll_options || []).length}/12)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPollOption}
                  disabled={(item.poll_options || []).length >= 12}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-2">
                {(item.poll_options || []).map((option, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder={`Opção ${i + 1}`}
                      value={option}
                      onChange={(e) => updatePollOption(i, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePollOption(i)}
                      disabled={(item.poll_options || []).length <= 2}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {(item.poll_options || []).length < 2 && (
                <p className="text-xs text-destructive">Mínimo de 2 opções</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id={`multi-${item.id}`}
                checked={item.poll_allow_multiple}
                onCheckedChange={(checked) =>
                  onChange({ ...item, poll_allow_multiple: checked })
                }
              />
              <Label htmlFor={`multi-${item.id}`} className="text-sm">
                Permitir múltiplas respostas
              </Label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
