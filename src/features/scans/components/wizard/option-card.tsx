"use client";

import { cn } from "cn";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export interface OptionCardProps {
  selected: boolean;
  onToggle: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** `radio` marks the control as single-choice for assistive technology. */
  role?: "checkbox" | "radio";
  className?: string;
  children?: ReactNode;
}

/** Selectable card used by the wizard's multi-select and single-choice steps. */
export function OptionCard({ selected, onToggle, title, description, icon, disabled = false, role = "checkbox", className, children }: OptionCardProps) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/50",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {icon ? <span className={cn("mt-0.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")}>{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
        {children}
      </span>
      {selected ? <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> : null}
    </button>
  );
}
