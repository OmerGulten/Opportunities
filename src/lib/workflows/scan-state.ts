import { ScanInvalidTransitionError } from "@/lib/errors";
import { ACTIVE_SCAN_STATUSES, TERMINAL_SCAN_STATUSES, type ScanStatus } from "@/types/common";

/**
 * Scan lifecycle state machine. `scans.status` is the single source of truth;
 * every transition goes through assertScanTransition().
 */
const TRANSITIONS: Record<ScanStatus, readonly ScanStatus[]> = {
  created: ["queued", "cancelled", "failed"],
  queued: ["discovering", "cancelled", "failed"],
  discovering: ["deduplicating", "cancelled", "failed", "completed"],
  deduplicating: ["enriching", "auditing", "scoring", "cancelled", "failed", "completed"],
  enriching: ["auditing", "scoring", "cancelled", "failed", "partially_completed", "completed"],
  auditing: ["scoring", "cancelled", "failed", "partially_completed", "completed"],
  scoring: ["completed", "partially_completed", "cancelled", "failed"],
  completed: [],
  partially_completed: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: ScanStatus, to: ScanStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertScanTransition(from: ScanStatus, to: ScanStatus): void {
  if (!canTransition(from, to)) throw new ScanInvalidTransitionError(from, to);
}

export function isActiveScanStatus(status: ScanStatus): boolean {
  return ACTIVE_SCAN_STATUSES.includes(status);
}

export function isTerminalScanStatus(status: ScanStatus): boolean {
  return TERMINAL_SCAN_STATUSES.includes(status);
}

export function isCancellable(status: ScanStatus): boolean {
  return canTransition(status, "cancelled");
}

/** Decide the final status once all work is done. */
export function finalStatusFor(counts: { discovered: number; failed: number; scored: number }, discoveryFailed: boolean): ScanStatus {
  if (discoveryFailed) return "failed";
  if (counts.discovered === 0) return "completed";
  if (counts.failed > 0 && counts.scored === 0) return "failed";
  if (counts.failed > 0) return "partially_completed";
  return "completed";
}

/** Human-facing progress percentage (0-100) from counters. */
export function scanProgressPercent(scan: { status: ScanStatus; discovered_count: number; audited_count: number; scored_count: number; failed_count: number }): number {
  if (isTerminalScanStatus(scan.status)) return 100;
  const weights: Partial<Record<ScanStatus, number>> = { created: 0, queued: 3, discovering: 10, deduplicating: 20, enriching: 25 };
  if (scan.status in weights) return weights[scan.status] ?? 0;
  const total = Math.max(scan.discovered_count, 1);
  const done = scan.scored_count + scan.failed_count;
  const auditShare = scan.audited_count / total;
  const scoreShare = done / total;
  const pct = 25 + Math.round(auditShare * 45 + scoreShare * 28);
  return Math.min(98, Math.max(25, pct));
}
