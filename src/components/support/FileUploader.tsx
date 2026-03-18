import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText, Image, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface FileWithPreview {
  file: File;
  preview?: string;
  error?: string;
}

interface FileUploaderProps {
  files: FileWithPreview[];
  onFilesChange: (files: FileWithPreview[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

function validateFile(file: File): string | null {
  // 1. Verificar tamanho
  if (file.size > MAX_FILE_SIZE) {
    return `Arquivo muito grande (máx. 5MB)`;
  }

  // 2. Verificar MIME type
  if (!ALLOWED_TYPES[file.type]) {
    return `Tipo de arquivo não permitido`;
  }

  // 3. Verificar extensão
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_TYPES[file.type].includes(ext)) {
    return `Extensão não corresponde ao tipo do arquivo`;
  }

  // 4. Prevenir double extension (ex: file.jpg.exe)
  const parts = file.name.split(".");
  if (parts.length > 2) {
    return `Nome de arquivo inválido`;
  }

  return null;
}

function sanitizeFileName(name: string): string {
  // Remove caracteres especiais, mantém apenas letras, números, - e _
  const ext = name.split(".").pop() || "";
  const baseName = name.replace(/\.[^/.]+$/, "");
  const sanitized = baseName.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50);
  return `${sanitized}.${ext}`;
}

export function FileUploader({
  files,
  onFilesChange,
  maxFiles = 5,
  disabled = false,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles || disabled) return;

    const fileArray = Array.from(newFiles);
    const validatedFiles: FileWithPreview[] = [];

    for (const file of fileArray) {
      if (files.length + validatedFiles.length >= maxFiles) break;

      const error = validateFile(file);
      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;

      validatedFiles.push({
        file: new File([file], sanitizeFileName(file.name), { type: file.type }),
        preview,
        error: error || undefined,
      });
    }

    onFilesChange([...files, ...validatedFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    if (newFiles[index].preview) {
      URL.revokeObjectURL(newFiles[index].preview!);
    }
    newFiles.splice(index, 1);
    onFilesChange(newFiles);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={Object.keys(ALLOWED_TYPES).join(",")}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || files.length >= maxFiles}
        >
          <Paperclip className="h-4 w-4 mr-2" />
          Anexar arquivo
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          JPG, PNG, GIF, WEBP, PDF ou TXT (máx. 5MB)
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileItem, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg border",
                fileItem.error ? "border-destructive bg-destructive/5" : "border-border"
              )}
            >
              {fileItem.preview ? (
                <img
                  src={fileItem.preview}
                  alt=""
                  className="h-10 w-10 object-cover rounded"
                />
              ) : (
                <div className="h-10 w-10 flex items-center justify-center bg-muted rounded">
                  {getFileIcon(fileItem.file.type)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(fileItem.file.size / 1024).toFixed(1)} KB
                </p>
                {fileItem.error && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {fileItem.error}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
