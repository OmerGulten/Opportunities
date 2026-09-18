import { cn } from "cn";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { toneTextClass, type Tone } from "./tokens";

type IconComponent = ComponentType<{ className?: string }>;

const defaultIcon: Record<Tone, IconComponent> = {
  positive: CircleCheck,
  attention: TriangleAlert,
  negative: CircleAlert,
  neutral: Info,
  info: Info,
};

const surfaceClass: Record<Tone, string> = {
  positive: "border-emerald-600/25 bg-emerald-500/8 dark:border-emerald-400/20",
  attention: "border-amber-600/25 bg-amber-500/10 dark:border-amber-400/20",
  negative: "border-rose-600/25 bg-rose-500/8 dark:border-rose-400/20",
  neutral: "border-border bg-muted/40",
  info: "border-sky-600/25 bg-sky-500/8 dark:border-sky-400/20",
};

export interface InlineAlertProps {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  /** Replace the default tone icon; pass `null` to drop it. */
  icon?: ReactNode | null;
  action?: ReactNode;
  className?: string;
}

/** Page-level notice: configuration problems, coverage limits, demo notices. */
export function InlineAlert({ tone = "info", title, children, icon, action, className }: InlineAlertProps) {
  const Icon = defaultIcon[tone];
  const hasIcon = icon !== null;
  return (
    <Alert className={cn(surfaceClass[tone], className)}>
      {icon === undefined ? <Icon className={cn("size-4", toneTextClass[tone])} /> : icon}
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {children ? <AlertDescription>{children}</AlertDescription> : null}
      {action ? <div className={cn("mt-2 flex flex-wrap gap-2", hasIcon && "col-start-2")}>{action}</div> : null}
    </Alert>
  );
}
