import type { ObservationStatus } from "@/types/common";
import type { Signal } from "@/types/signals";

/**
 * Statuses that carry an actual observation. `not_checked`, `unavailable` and
 * `error` mean "we do not know" and must never contribute to a score or a gap.
 */
export const EVALUABLE_STATUSES: ReadonlySet<ObservationStatus> = new Set<ObservationStatus>(["found", "not_found", "ambiguous"]);

export function isEvaluableSignal(signal: Signal): boolean {
  return EVALUABLE_STATUSES.has(signal.status);
}

function timestamp(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/**
 * Indexes signals by type. When a type appears more than once the newest
 * `detectedAt` wins; equal (or unparsable) timestamps fall back to array order,
 * so the later entry wins.
 */
export function indexSignalsByType(signals: readonly Signal[]): Map<string, Signal> {
  const index = new Map<string, Signal>();
  for (const signal of signals) {
    if (!signal || typeof signal.signalType !== "string" || signal.signalType === "") continue;
    const existing = index.get(signal.signalType);
    if (!existing || timestamp(signal.detectedAt) >= timestamp(existing.detectedAt)) {
      index.set(signal.signalType, signal);
    }
  }
  return index;
}
