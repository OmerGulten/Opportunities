"use client";

import { cn } from "cn";
import { Check } from "lucide-react";

import { useT } from "@/lib/i18n/client";

export interface ProgressStep {
  id: string;
  label: string;
  description?: string;
}

export interface ProgressStepsProps {
  steps: ProgressStep[];
  /** Zero-based index of the active step. */
  current: number;
  /** Enables navigation back to already completed steps. */
  onStepClick?: (index: number) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/** Numbered wizard progress with completed / current / upcoming states. */
export function ProgressSteps({ steps, current, onStepClick, orientation = "horizontal", className }: ProgressStepsProps) {
  const t = useT("common");

  return (
    <ol
      aria-label={t("steps.stepOf", { current: Math.min(current + 1, steps.length), total: steps.length })}
      className={cn(
        orientation === "horizontal" ? "flex w-full flex-wrap items-center gap-x-1 gap-y-2" : "flex w-full flex-col gap-1",
        className,
      )}
    >
      {steps.map((step, index) => {
        const isDone = index < current;
        const isCurrent = index === current;
        const clickable = Boolean(onStepClick) && index < current;
        const content = (
          <>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors",
                isDone && "border-primary bg-primary text-primary-foreground",
                isCurrent && "border-primary text-primary ring-3 ring-primary/20",
                !isDone && !isCurrent && "border-border text-muted-foreground",
              )}
              aria-hidden
            >
              {isDone ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className="flex min-w-0 flex-col text-left">
              <span className={cn("truncate text-sm leading-tight", isCurrent ? "font-medium text-foreground" : "text-muted-foreground")}>{step.label}</span>
              {step.description && orientation === "vertical" ? <span className="truncate text-xs text-muted-foreground">{step.description}</span> : null}
            </span>
          </>
        );

        return (
          <li
            key={step.id}
            aria-current={isCurrent ? "step" : undefined}
            className={cn("flex min-w-0 items-center gap-2", orientation === "horizontal" && "flex-1 basis-32")}
          >
            {clickable ? (
              <button type="button" onClick={() => onStepClick?.(index)} className="flex min-w-0 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                {content}
              </button>
            ) : (
              <div className="flex min-w-0 items-center gap-2">{content}</div>
            )}
            {orientation === "horizontal" && index < steps.length - 1 ? (
              <span className={cn("hidden h-px flex-1 sm:block", isDone ? "bg-primary/50" : "bg-border")} aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
