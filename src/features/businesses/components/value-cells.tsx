"use client";

import { cn } from "cn";

import { toneBadgeClass } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/client";

/**
 * Leaf renderers for audit values.
 *
 * A value that was never recorded is rendered as "not checked" and is visually
 * distinct from a recorded `false`, which is a real observation.
 */

export function BoolValue({ value, className }: { value: boolean | null | undefined; className?: string }) {
  const t = useT("common");

  if (value === null || value === undefined) {
    return (
      <Badge variant="outline" className={cn(toneBadgeClass.neutral, className)}>
        {t("observation.not_checked")}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn(value ? toneBadgeClass.positive : toneBadgeClass.negative, className)}>
      {value ? t("yes") : t("no")}
    </Badge>
  );
}

export function TextValue({
  value,
  suffix,
  className,
}: {
  value: string | number | null | undefined;
  suffix?: string;
  className?: string;
}) {
  const t = useT("common");

  if (value === null || value === undefined || value === "") {
    return <span className={cn("text-sm text-muted-foreground", className)}>{t("states.notAvailable")}</span>;
  }

  return (
    <span className={cn("text-sm tabular-nums", className)}>
      {value}
      {suffix ? <span className="ml-1 text-muted-foreground">{suffix}</span> : null}
    </span>
  );
}

/** A labelled value that is explicitly marked as not measured. */
export function NotCheckedValue({ className }: { className?: string }) {
  const t = useT("common");
  return (
    <Badge variant="outline" className={cn(toneBadgeClass.neutral, className)}>
      {t("observation.not_checked")}
    </Badge>
  );
}
