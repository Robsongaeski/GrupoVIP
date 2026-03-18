import * as React from "react";
import { Check, ArrowRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface OnboardingStep {
  label: string;
  description?: string;
  isComplete?: boolean;
}

interface OnboardingCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  steps?: OnboardingStep[];
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  variant?: "default" | "compact" | "hero";
}

export function OnboardingCard({
  title,
  description,
  icon: Icon,
  steps,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  variant = "default",
}: OnboardingCardProps) {
  if (variant === "hero") {
    return (
      <Card className={cn("border-primary/20 bg-gradient-to-br from-primary/5 to-transparent", className)}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          {Icon && (
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Icon className="h-10 w-10 text-primary" />
            </div>
          )}
          <h2 className="text-2xl font-bold mb-3">{title}</h2>
          {description && (
            <p className="text-muted-foreground max-w-md mb-6">{description}</p>
          )}
          
          {steps && steps.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm",
                    step.isComplete
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step.isComplete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-muted-foreground/20 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                  )}
                  {step.label}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            {actionLabel && (
              <Button size="lg" onClick={onAction}>
                {actionLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {secondaryActionLabel && (
              <Button variant="outline" size="lg" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-4 p-4 rounded-lg border bg-card", className)}>
        {Icon && (
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground truncate">{description}</p>
          )}
        </div>
        {actionLabel && (
          <Button size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6 text-primary" />
            </div>
          )}
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps && steps.length > 0 && (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                    step.isComplete
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step.isComplete ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <div>
                  <p className={cn("text-sm font-medium", step.isComplete && "text-muted-foreground line-through")}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {(actionLabel || secondaryActionLabel) && (
          <div className="flex gap-2 pt-2">
            {actionLabel && (
              <Button onClick={onAction} className="gap-2">
                {actionLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {secondaryActionLabel && (
              <Button variant="outline" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Simple tip card for contextual help
interface TipCardProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  className?: string;
}

export function TipCard({ title, description, icon: Icon, className }: TipCardProps) {
  return (
    <div className={cn("flex gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10", className)}>
      {Icon && <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />}
      <div>
        <p className="text-sm font-medium text-primary">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
