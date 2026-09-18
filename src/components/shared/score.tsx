"use client";

import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/client";

import { clampScore, scoreTier, scoreTierTone, toneBadgeClass, toneFillClass, toneStrokeClass, toneTextClass } from "./tokens";

export type ScoreSize = "sm" | "md" | "lg";

const badgeSizeClass: Record<ScoreSize, string> = {
  sm: "h-5 px-1.5 text-[0.7rem]",
  md: "h-6 px-2 text-xs",
  lg: "h-7 px-2.5 text-sm",
};

export interface ScoreBadgeProps {
  /** 0-100. `null` means the business has not been scored, which is not zero. */
  score: number | null | undefined;
  size?: ScoreSize;
  /** Append the tier label ("High opportunity"). */
  showTier?: boolean;
  className?: string;
}

export function ScoreBadge({ score, size = "md", showTier = false, className }: ScoreBadgeProps) {
  const t = useT("common");
  if (score === null || score === undefined) {
    return (
      <Badge variant="outline" className={cn(badgeSizeClass[size], "font-medium text-muted-foreground", className)}>
        {t("score.notScored")}
      </Badge>
    );
  }
  const value = Math.round(clampScore(score));
  const tier = scoreTier(value);
  return (
    <Badge variant="outline" className={cn(badgeSizeClass[size], "font-semibold tabular-nums", toneBadgeClass[scoreTierTone[tier]], className)}>
      {value}
      {showTier ? <span className="font-normal opacity-80">{t(`score.tiers.${tier}`)}</span> : null}
    </Badge>
  );
}

const ringGeometry: Record<ScoreSize, { box: number; stroke: number; text: string; caption: string }> = {
  sm: { box: 40, stroke: 4, text: "text-xs", caption: "text-[0.6rem]" },
  md: { box: 56, stroke: 5, text: "text-sm", caption: "text-[0.65rem]" },
  lg: { box: 76, stroke: 6, text: "text-lg", caption: "text-xs" },
};

export interface ScoreRingProps {
  score: number | null | undefined;
  size?: ScoreSize;
  /** Small caption under the number (for example the service name). */
  caption?: string;
  className?: string;
}

/** Circular 0-100 readout. Renders a dashed, muted ring when not scored. */
export function ScoreRing({ score, size = "md", caption, className }: ScoreRingProps) {
  const t = useT("common");
  const { box, stroke, text, caption: captionClass } = ringGeometry[size];
  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const scored = score !== null && score !== undefined;
  const value = scored ? Math.round(clampScore(score)) : 0;
  const tone = scored ? scoreTierTone[scoreTier(value)] : "neutral";
  const label = scored ? t("score.outOf", { score: value }) : t("score.notScored");

  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)} title={label}>
      <div className="relative" style={{ width: box, height: box }}>
        <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="-rotate-90" role="img" aria-label={label}>
          <circle
            cx={box / 2}
            cy={box / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
            strokeDasharray={scored ? undefined : `${stroke * 1.5} ${stroke * 1.5}`}
          />
          {scored ? (
            <circle
              cx={box / 2}
              cy={box / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              className={toneStrokeClass[tone]}
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (circumference * value) / 100}
            />
          ) : null}
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-semibold tabular-nums",
            text,
            scored ? toneTextClass[tone] : "text-muted-foreground",
          )}
          aria-hidden
        >
          {scored ? value : "–"}
        </span>
      </div>
      {caption ? <span className={cn("max-w-24 truncate text-muted-foreground", captionClass)}>{caption}</span> : null}
    </div>
  );
}

export interface ScoreBarProps {
  score: number | null | undefined;
  label?: string;
  /** Show the numeric value at the end of the row. */
  showValue?: boolean;
  className?: string;
}

/** Horizontal score readout for dense lists of per-service scores. */
export function ScoreBar({ score, label, showValue = true, className }: ScoreBarProps) {
  const t = useT("common");
  const scored = score !== null && score !== undefined;
  const value = scored ? Math.round(clampScore(score)) : 0;
  const tone = scored ? scoreTierTone[scoreTier(value)] : "neutral";

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      {label ? <span className="min-w-0 flex-1 truncate text-sm">{label}</span> : null}
      <div
        className="h-1.5 w-full max-w-40 shrink-0 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={scored ? value : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? t("score.label")}
      >
        {scored ? <div className={cn("h-full rounded-full transition-[width]", toneFillClass[tone])} style={{ width: `${value}%` }} /> : null}
      </div>
      {showValue ? (
        <span className={cn("w-10 shrink-0 text-right text-xs tabular-nums", scored ? toneTextClass[tone] : "text-muted-foreground")}>
          {scored ? value : "–"}
        </span>
      ) : null}
    </div>
  );
}
