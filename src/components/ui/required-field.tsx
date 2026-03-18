import * as React from "react";
import { Check, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RequiredFieldProps {
  label: string;
  required?: boolean;
  isValid?: boolean;
  showValidation?: boolean;
  helpText?: string;
  errorMessage?: string;
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}

export function RequiredField({
  label,
  required = false,
  isValid,
  showValidation = true,
  helpText,
  errorMessage,
  className,
  children,
  htmlFor,
}: RequiredFieldProps) {
  const showError = showValidation && errorMessage;
  const showSuccess = showValidation && isValid && !errorMessage;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Label
          htmlFor={htmlFor}
          className={cn(
            "flex items-center gap-1",
            showError && "text-destructive"
          )}
        >
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
        
        {helpText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">{helpText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {showSuccess && (
          <Check className="h-4 w-4 text-green-500" />
        )}
        
        {showError && (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
      </div>

      <div
        className={cn(
          "relative",
          showError && "[&>*]:border-destructive [&>*]:focus-visible:ring-destructive",
          showSuccess && "[&>*]:border-green-500 [&>*]:focus-visible:ring-green-500"
        )}
      >
        {children}
      </div>

      {showError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {errorMessage}
        </p>
      )}
    </div>
  );
}

// Simplified version for inline validation
interface FieldValidationProps {
  isValid: boolean;
  errorMessage?: string;
  successMessage?: string;
  className?: string;
}

export function FieldValidation({
  isValid,
  errorMessage,
  successMessage,
  className,
}: FieldValidationProps) {
  if (!errorMessage && !successMessage) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs mt-1",
        isValid ? "text-green-600" : "text-destructive",
        className
      )}
    >
      {isValid ? (
        <>
          <Check className="h-3 w-3" />
          {successMessage}
        </>
      ) : (
        <>
          <AlertCircle className="h-3 w-3" />
          {errorMessage}
        </>
      )}
    </div>
  );
}

// Required field indicator (just the asterisk)
export function RequiredIndicator({ className }: { className?: string }) {
  return (
    <span className={cn("text-destructive ml-0.5", className)}>*</span>
  );
}
