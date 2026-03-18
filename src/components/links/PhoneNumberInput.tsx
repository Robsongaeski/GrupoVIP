import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
}

// Format: (11) 99999-8888 (sem mostrar o +55)
function formatPhoneNumber(value: string): string {
  // Remove tudo que não é número
  let numbers = value.replace(/\D/g, "");
  
  // Remove o 55 do início se existir (quando colar número completo)
  if (numbers.startsWith("55") && numbers.length > 11) {
    numbers = numbers.slice(2);
  }
  
  // Limita a 11 dígitos (DDD + 9 dígitos)
  const limited = numbers.slice(0, 11);
  
  if (limited.length === 0) return "";
  
  // Formata progressivamente
  let formatted = "(";
  
  if (limited.length >= 1) {
    formatted += limited.slice(0, 2); // DDD
  }
  
  if (limited.length >= 3) {
    formatted += ") " + limited.slice(2, 7); // Primeira parte
  }
  
  if (limited.length >= 8) {
    formatted += "-" + limited.slice(7, 11); // Segunda parte
  }
  
  return formatted;
}

// Extrai apenas números e adiciona 55 para salvar
function extractNumbers(value: string): string {
  let numbers = value.replace(/\D/g, "");
  // Remove 55 se existir no início
  if (numbers.startsWith("55") && numbers.length > 11) {
    numbers = numbers.slice(2);
  }
  // Adiciona 55 antes de retornar (para salvar no banco)
  return numbers.length > 0 ? "55" + numbers : "";
}

export function PhoneNumberInput({
  value,
  onChange,
  placeholder = "(11) 99999-8888",
  className,
  error,
  disabled,
}: PhoneNumberInputProps) {
  const [displayValue, setDisplayValue] = useState(() => formatPhoneNumber(value));

  useEffect(() => {
    // Atualiza o display quando o value externo muda
    setDisplayValue(formatPhoneNumber(value));
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formatted = formatPhoneNumber(inputValue);
    setDisplayValue(formatted);
    onChange(extractNumbers(formatted));
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const formatted = formatPhoneNumber(pastedText);
    setDisplayValue(formatted);
    onChange(extractNumbers(formatted));
  }, [onChange]);

  return (
    <Input
      type="tel"
      value={displayValue}
      onChange={handleChange}
      onPaste={handlePaste}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        error && "border-destructive focus-visible:ring-destructive",
        className
      )}
    />
  );
}
