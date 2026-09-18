import { getT, type TFunction, type TranslateParams } from "@/lib/i18n";
import type { ConfidenceLevel, EvidenceType, Locale, ObservationStatus } from "@/types/common";
import { makeSignal, makeUnavailableSignal, type Signal, type SignalSource, type SignalValue } from "@/types/signals";

/**
 * Signal explanations live in the `findings` namespace under `signal.<key>`,
 * where `<key>` is the signal type with dots replaced by underscores
 * (`website.has_cta` -> `signal.website_has_cta`). Explanations for signals that
 * could not be established come from `unavailable.<reason>` instead, so a
 * "not checked" signal always says *why* it was not checked.
 */
export function signalMessageKey(signalType: string): string {
  return `signal.${signalType.replace(/\./g, "_")}`;
}

/** Reasons a signal could not be established. Each is a key of the `unavailable.*` tree. */
export const UNAVAILABLE_REASONS = [
  "website_not_found",
  "website_not_reachable",
  "website_invalid",
  "website_not_audited",
  "website_discovery_depth",
  "robots_not_checked",
  "broken_links_not_checked",
  "google_field_not_requested",
  "google_no_owner_replies",
  "instagram_not_fetched",
  "instagram_not_checked",
  "performance_not_run",
  "performance_no_website",
  "performance_metric_unavailable",
  "audit_failed",
] as const;

export type UnavailableReason = (typeof UNAVAILABLE_REASONS)[number];

export interface EmitOptions {
  status?: ObservationStatus;
  evidenceType?: EvidenceType;
  confidence?: ConfidenceLevel;
  params?: TranslateParams;
  source?: SignalSource;
  detectedAt?: string;
}

export interface SignalFactory {
  t: TFunction;
  emit(signalType: string, value: SignalValue, opts?: EmitOptions): Signal;
  unavailable(
    signalType: string,
    reason: UnavailableReason,
    opts?: { status?: Extract<ObservationStatus, "not_checked" | "unavailable" | "error">; source?: SignalSource; params?: TranslateParams },
  ): Signal;
  /** Formats a value for the `{{value}}` placeholder of an explanation. */
  format(value: SignalValue): string;
}

export function createSignalFactory(locale: Locale, defaultSource: SignalSource): SignalFactory {
  const t = getT(locale, "findings");

  const format = (value: SignalValue): string => {
    if (value === null) return t("value.unknown");
    if (typeof value === "boolean") return value ? t("value.yes") : t("value.no");
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  };

  return {
    t,
    format,
    emit(signalType, value, opts = {}) {
      const params: TranslateParams = { value: format(value), ...(opts.params ?? {}) };
      return makeSignal(signalType, value, {
        source: opts.source ?? defaultSource,
        status: opts.status ?? "found",
        evidenceType: opts.evidenceType ?? "observed",
        confidence: opts.confidence ?? "high",
        explanation: t(signalMessageKey(signalType), params),
        ...(opts.detectedAt !== undefined ? { detectedAt: opts.detectedAt } : {}),
      });
    },
    unavailable(signalType, reason, opts = {}) {
      return makeUnavailableSignal(signalType, {
        source: opts.source ?? defaultSource,
        explanation: t(`unavailable.${reason}`, opts.params),
        status: opts.status ?? "not_checked",
      });
    },
  };
}

/** Later signals of the same type win; used when merging sub-audit results. */
export function mergeSignals(groups: ReadonlyArray<readonly Signal[]>): Signal[] {
  const byType = new Map<string, Signal>();
  for (const group of groups) {
    for (const signal of group) {
      if (typeof signal.signalType !== "string" || signal.signalType === "") continue;
      byType.set(signal.signalType, signal);
    }
  }
  return [...byType.values()];
}
