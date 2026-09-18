import { cn } from "cn";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

import { toneTextClass, type Tone } from "./tokens";

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Neutral supporting line; never a claim the data does not support. */
  description?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  footer?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, description, icon, tone, footer, className }: StatCardProps) {
  return (
    <Card size="sm" className={cn("gap-2", className)}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className={cn("mt-1 font-heading text-2xl leading-tight font-semibold tabular-nums", tone && toneTextClass[tone])}>{value}</p>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {icon ? (
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted", tone ? toneTextClass[tone] : "text-muted-foreground")}>
            {icon}
          </span>
        ) : null}
      </CardContent>
      {footer ? <CardContent className="text-xs text-muted-foreground">{footer}</CardContent> : null}
    </Card>
  );
}

export interface KpiProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  align?: "start" | "center";
  className?: string;
}

/** Compact stat without card chrome; for header strips and summary rows. */
export function Kpi({ label, value, hint, icon, tone, align = "start", className }: KpiProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", align === "center" && "items-center text-center", className)}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon ? <span className={cn("[&_svg]:size-3.5", tone && toneTextClass[tone])}>{icon}</span> : null}
        {label}
      </span>
      <span className={cn("font-heading text-lg leading-tight font-semibold tabular-nums", tone && toneTextClass[tone])}>{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
