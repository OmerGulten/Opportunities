"use client";

import { cn } from "cn";
import { FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/client";

export interface DemoBadgeProps {
  /** Hide the explanation tooltip (for example in a tight toolbar). */
  withTooltip?: boolean;
  className?: string;
}

/**
 * Persistent indicator that at least one provider is serving fictional data.
 * Rendered from server code that read `getDemoFlags()`.
 */
export function DemoBadge({ withTooltip = true, className }: DemoBadgeProps) {
  const t = useT("common");
  const badge = (
    <Badge variant="outline" className={cn("border-amber-600/25 bg-amber-500/14 text-amber-700 dark:border-amber-400/25 dark:text-amber-300", className)}>
      <FlaskConical className="size-3" />
      {t("demo.badge")}
    </Badge>
  );

  if (!withTooltip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{badge}</TooltipTrigger>
      <TooltipContent>{t("demo.description")}</TooltipContent>
    </Tooltip>
  );
}
