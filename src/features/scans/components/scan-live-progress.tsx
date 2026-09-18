"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InlineAlert, Kpi } from "@/components/shared";
import { useFormatters, useT } from "@/lib/i18n/client";
import { ACTIVE_SCAN_STATUSES, type ScanStatus } from "@/types/common";

import { ScanProgressBar } from "./scan-progress-bar";
import { ScanStatusBadge } from "./scan-status-badge";

const POLL_INTERVAL_MS = 3000;

export interface ScanProgressSnapshot {
  status: ScanStatus;
  percent: number;
  totalTargets: number;
  discovered: number;
  audited: number;
  scored: number;
  failed: number;
  errorCode: string | null;
}

interface ScanStatusPayload {
  status?: ScanStatus;
  total_targets?: number;
  discovered_count?: number;
  audited_count?: number;
  scored_count?: number;
  failed_count?: number;
  error_code?: string | null;
  progress?: { percent?: number };
}

export interface ScanLiveProgressProps {
  scanId: string;
  initial: ScanProgressSnapshot;
}

/**
 * Live counters for a running scan.
 *
 * While the scan is active the detail endpoint is polled every few seconds; the
 * interval is torn down as soon as the status becomes terminal, and the server
 * page is refreshed once so targets, events and credits come from the database
 * rather than from this component's local copy.
 */
export function ScanLiveProgress({ scanId, initial }: ScanLiveProgressProps) {
  const t = useT("scans");
  const te = useT("errors");
  const { number } = useFormatters();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ScanProgressSnapshot>(initial);

  const active = ACTIVE_SCAN_STATUSES.includes(snapshot.status);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let stopped = false;

    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/scans/${scanId}`, {
            signal: controller.signal,
            headers: { accept: "application/json" },
          });
          if (!response.ok || stopped) return;
          const payload = (await response.json()) as { data?: ScanStatusPayload };
          const data = payload.data;
          if (!data?.status || stopped) return;
          setSnapshot({
            status: data.status,
            percent: data.progress?.percent ?? 0,
            totalTargets: data.total_targets ?? 0,
            discovered: data.discovered_count ?? 0,
            audited: data.audited_count ?? 0,
            scored: data.scored_count ?? 0,
            failed: data.failed_count ?? 0,
            errorCode: data.error_code ?? null,
          });
          if (!ACTIVE_SCAN_STATUSES.includes(data.status)) router.refresh();
        } catch {
          // A transient failure should not stop the poller; the next tick retries.
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [scanId, active, router]);

  return (
    <div className="panel flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ScanStatusBadge status={snapshot.status} />
          {active ? <span className="text-xs text-muted-foreground">{t("detail.liveUpdating")}</span> : null}
        </div>
        <span className="font-heading text-lg font-semibold tabular-nums">{number(Math.round(snapshot.percent))}%</span>
      </div>

      <ScanProgressBar percent={snapshot.percent} status={snapshot.status} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label={t("counters.targets")} value={number(snapshot.totalTargets)} />
        <Kpi label={t("counters.discovered")} value={number(snapshot.discovered)} />
        <Kpi label={t("counters.audited")} value={number(snapshot.audited)} />
        <Kpi label={t("counters.scored")} value={number(snapshot.scored)} />
        <Kpi label={t("counters.failed")} value={number(snapshot.failed)} tone={snapshot.failed > 0 ? "negative" : undefined} />
      </div>

      {snapshot.errorCode ? (
        <InlineAlert tone="negative" title={t("detail.errorTitle")}>
          {te(snapshot.errorCode)}
        </InlineAlert>
      ) : null}
    </div>
  );
}
