"use client";

import { cn } from "cn";

import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { useT } from "@/lib/i18n/client";
import type { ScanStatus } from "@/types/common";

export interface ScanProgressBarProps {
  percent: number;
  status: ScanStatus;
  /** Renders the stage label and the percentage above the bar. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Progress of a scan. The percentage comes from `scanProgressPercent` on the
 * server: it is a stage-and-counter estimate, not a time prediction.
 */
export function ScanProgressBar({ percent, status, showLabel = false, className }: ScanProgressBarProps) {
  const t = useT("scans");
  const value = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <Progress value={value} aria-label={t(`status.${status}`)} className={cn("gap-1.5", className)}>
      {showLabel ? (
        <>
          <ProgressLabel className="text-xs text-muted-foreground">{t(`status.${status}`)}</ProgressLabel>
          <ProgressValue className="text-xs" />
        </>
      ) : null}
    </Progress>
  );
}
