"use client";

import { cn } from "cn";
import { Info, MapPin } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/client";

export interface GoogleAttributionProps {
  /** `compact` is a single inline line; `full` adds the provider sentence. */
  variant?: "compact" | "full";
  className?: string;
}

/**
 * Provider attribution shown wherever Google-sourced place content appears.
 *
 * NOTE FOR RELEASE: Google brand guidelines require the official "Google Maps"
 * logo asset (correct lockup, clear space and minimum size) rather than a text
 * label next to a generic pin. Drop the asset into /public and swap the glyph
 * below before shipping to production; the text form here is a placeholder that
 * keeps the attribution present and legible in both themes.
 */
export function GoogleAttribution({ variant = "compact", className }: GoogleAttributionProps) {
  const t = useT("common");
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <MapPin className="size-3.5 shrink-0" aria-hidden />
      <span className="font-medium">{t("attribution.googleMaps")}</span>
      {variant === "full" ? <span>· {t("attribution.poweredBy")}</span> : null}
    </span>
  );
}

export interface NotExhaustiveNoticeProps {
  /** `inline` is a muted sentence; `tooltip` is an icon with the sentence. */
  variant?: "inline" | "tooltip";
  className?: string;
}

/** States plainly that provider results are not a census of the area. */
export function NotExhaustiveNotice({ variant = "inline", className }: NotExhaustiveNoticeProps) {
  const t = useT("common");

  if (variant === "tooltip") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}
              aria-label={t("attribution.notExhaustive")}
            />
          }
        >
          <Info className="size-3.5" aria-hidden />
          {t("attribution.notExhaustiveTitle")}
        </TooltipTrigger>
        <TooltipContent>{t("attribution.notExhaustive")}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <p className={cn("flex items-start gap-1.5 text-xs text-muted-foreground", className)}>
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{t("attribution.notExhaustive")}</span>
    </p>
  );
}
