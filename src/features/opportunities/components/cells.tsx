"use client";

import { cn } from "cn";

import { StatusBadge, WebsiteStatusBadge, toneBadgeClass } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/lib/i18n/client";
import type { ObservationStatus } from "@/types/common";
import type { WebsiteStatus } from "@/types/signals";

import { GAP_VALUES } from "./filter-state";

/**
 * Table cells that turn raw signal values into explicit statuses.
 *
 * A missing value means the signal was never produced, which is rendered as
 * "not checked" — never as "not found".
 */

const WEBSITE_STATUSES: readonly WebsiteStatus[] = ["found", "not_found", "unreachable", "redirected", "invalid", "not_checked"];
const OBSERVATION_STATUSES: readonly ObservationStatus[] = ["found", "not_found", "not_checked", "unavailable", "error", "ambiguous"];

export function toWebsiteStatus(value: string | null | undefined): WebsiteStatus {
  return value && (WEBSITE_STATUSES as readonly string[]).includes(value) ? (value as WebsiteStatus) : "not_checked";
}

export function toObservationStatus(value: string | null | undefined): ObservationStatus {
  return value && (OBSERVATION_STATUSES as readonly string[]).includes(value) ? (value as ObservationStatus) : "not_checked";
}

export function WebsiteStatusCell({ status }: { status: string | null | undefined }) {
  return <WebsiteStatusBadge status={toWebsiteStatus(status)} />;
}

export function InstagramStatusCell({ status }: { status: string | null | undefined }) {
  return <StatusBadge status={toObservationStatus(status)} />;
}

/**
 * `google.profile_completeness` is "complete" | "incomplete". Anything else
 * means the Google audit did not produce the signal.
 */
export function GoogleCompletenessCell({ value }: { value: string | null | undefined }) {
  const t = useT("opportunities");
  const known = value === "complete" || value === "incomplete";
  const tone = value === "complete" ? "positive" : value === "incomplete" ? "attention" : "neutral";
  const label = known ? t(`google.${value}`) : t("google.not_checked");
  return (
    <Badge variant="outline" className={toneBadgeClass[tone]}>
      {label}
    </Badge>
  );
}

const KNOWN_GAPS: readonly string[] = GAP_VALUES;

export interface DigitalGapBadgesProps {
  gaps: string[] | null | undefined;
  /** Badges to render before collapsing the rest into a counter. */
  max?: number;
  className?: string;
}

export function DigitalGapBadges({ gaps, max = 3, className }: DigitalGapBadgesProps) {
  const t = useT("opportunities");
  const known = (gaps ?? []).filter((gap) => KNOWN_GAPS.includes(gap));

  if (known.length === 0) {
    return <span className="text-xs text-muted-foreground">{t("cells.noGaps")}</span>;
  }

  const shown = known.slice(0, max);
  const rest = known.slice(max);

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((gap) => (
        <Badge key={gap} variant="outline" className={cn(toneBadgeClass.attention, "font-normal")}>
          {t(`gaps.${gap}`)}
        </Badge>
      ))}
      {rest.length > 0 ? (
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {t("cells.moreGaps", { count: rest.length })}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <span className="flex flex-col gap-0.5">
              {rest.map((gap) => (
                <span key={gap}>{t(`gaps.${gap}`)}</span>
              ))}
            </span>
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
