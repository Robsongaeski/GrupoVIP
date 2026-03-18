import * as React from "react";
import { AlertCircle, AlertTriangle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ValidationItem {
  id: string;
  message: string;
  severity: "error" | "warning" | "info";
  fieldId?: string;
}

interface ValidationSummaryProps {
  items: ValidationItem[];
  onItemClick?: (item: ValidationItem) => void;
  onDismiss?: () => void;
  className?: string;
  title?: string;
}

export function ValidationSummary({
  items,
  onItemClick,
  onDismiss,
  className,
  title = "Itens pendentes",
}: ValidationSummaryProps) {
  if (items.length === 0) return null;

  const errors = items.filter((i) => i.severity === "error");
  const warnings = items.filter((i) => i.severity === "warning");

  const getSeverityIcon = (severity: ValidationItem["severity"]) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityClass = (severity: ValidationItem["severity"]) => {
    switch (severity) {
      case "error":
        return "bg-destructive/10 border-destructive/30 hover:bg-destructive/20";
      case "warning":
        return "bg-warning/10 border-warning/30 hover:bg-warning/20";
      default:
        return "bg-muted border-muted-foreground/20 hover:bg-muted/80";
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-3",
        errors.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {errors.length > 0 ? (
            <AlertCircle className="h-5 w-5 text-destructive" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-warning" />
          )}
          <h4 className="font-medium text-sm">{title}</h4>
          <span className="text-xs text-muted-foreground">
            ({errors.length} erro{errors.length !== 1 && "s"}
            {warnings.length > 0 && `, ${warnings.length} aviso${warnings.length !== 1 && "s"}`})
          </span>
        </div>
        {onDismiss && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors",
              getSeverityClass(item.severity),
              onItemClick && item.fieldId && "cursor-pointer"
            )}
            onClick={() => onItemClick?.(item)}
          >
            {getSeverityIcon(item.severity)}
            <span className="flex-1">{item.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Inline validation badge (compact)
interface ValidationBadgeProps {
  errorsCount: number;
  warningsCount?: number;
  className?: string;
}

export function ValidationBadge({
  errorsCount,
  warningsCount = 0,
  className,
}: ValidationBadgeProps) {
  const total = errorsCount + warningsCount;

  if (total === 0) {
    return (
      <span className={cn("flex items-center gap-1 text-xs text-green-600", className)}>
        <Check className="h-3.5 w-3.5" />
        Completo
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs",
        errorsCount > 0 ? "text-destructive" : "text-warning",
        className
      )}
    >
      {errorsCount > 0 ? (
        <AlertCircle className="h-3.5 w-3.5" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" />
      )}
      {total} {total === 1 ? "item" : "itens"} pendente{total !== 1 && "s"}
    </span>
  );
}

// Section completeness indicator
interface SectionStatusProps {
  isComplete: boolean;
  label?: string;
  className?: string;
}

export function SectionStatus({ isComplete, label, className }: SectionStatusProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs",
        isComplete ? "text-green-600" : "text-muted-foreground",
        className
      )}
    >
      {isComplete ? (
        <>
          <Check className="h-4 w-4" />
          {label || "Completo"}
        </>
      ) : (
        <>
          <AlertCircle className="h-4 w-4" />
          {label || "Pendente"}
        </>
      )}
    </div>
  );
}
