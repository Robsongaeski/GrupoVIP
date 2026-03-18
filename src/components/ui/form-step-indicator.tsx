import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  isComplete?: boolean;
  isDisabled?: boolean;
}

interface FormStepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function FormStepIndicator({
  steps,
  currentStep,
  onStepClick,
  orientation = "horizontal",
  className,
}: FormStepIndicatorProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <div
      className={cn(
        "w-full",
        isHorizontal ? "flex items-center justify-between" : "flex flex-col gap-2",
        className
      )}
    >
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = step.isComplete || index < currentStep;
        const isClickable = onStepClick && !step.isDisabled && (isCompleted || index <= currentStep);

        return (
          <React.Fragment key={step.id}>
            <div
              className={cn(
                "flex items-center gap-3",
                isHorizontal && "flex-1",
                isClickable && "cursor-pointer",
                step.isDisabled && "opacity-50"
              )}
              onClick={() => isClickable && onStepClick?.(index)}
            >
              {/* Step Circle */}
              <div
                className={cn(
                  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  isActive && !isCompleted && "border-primary bg-primary/10 text-primary",
                  !isActive && !isCompleted && "border-muted-foreground/30 bg-background text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : step.icon ? (
                  step.icon
                ) : (
                  index + 1
                )}
              </div>

              {/* Step Content */}
              <div className={cn("min-w-0", isHorizontal && "hidden sm:block")}>
                <p
                  className={cn(
                    "text-sm font-medium truncate",
                    isActive && "text-primary",
                    isCompleted && "text-foreground",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {step.description}
                  </p>
                )}
              </div>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && isHorizontal && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-2 transition-colors",
                  index < currentStep ? "bg-primary" : "bg-muted-foreground/20"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Compact version for smaller spaces
export function FormStepIndicatorCompact({
  steps,
  currentStep,
  className,
}: Omit<FormStepIndicatorProps, "orientation" | "onStepClick">) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = step.isComplete || index < currentStep;

        return (
          <React.Fragment key={step.id}>
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                isCompleted && "bg-primary text-primary-foreground",
                isActive && !isCompleted && "bg-primary/10 text-primary border border-primary",
                !isActive && !isCompleted && "bg-muted text-muted-foreground"
              )}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="text-xs font-bold">{index + 1}</span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>

            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-4 h-0.5",
                  index < currentStep ? "bg-primary" : "bg-muted-foreground/20"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
