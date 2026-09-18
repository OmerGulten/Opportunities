import type { BusinessDetail } from "@/features/businesses/queries";
import { dateLocaleTag } from "@/lib/i18n";
import type {
  AuditType,
  BenchmarkMetrics,
  GoogleBusinessAuditSummary,
  InstagramAuditSummary,
  PerformanceAuditSummary,
  WebsiteAuditSummary,
} from "@/types/audits";
import type { Json, Locale } from "@/types/common";

/**
 * Readers for stored audit summaries.
 *
 * Summaries are persisted as JSON, so every field is treated as possibly
 * absent: `DeepLoose` turns the audit types into "present, null, or not
 * recorded" shapes. The UI then renders a missing field as "not checked"
 * instead of inventing an absence.
 */

export type AuditWithFindings = BusinessDetail["audits"][number];

export type DeepLoose<T> = T extends (infer U)[]
  ? Array<DeepLoose<U>>
  : T extends object
    ? { [K in keyof T]?: DeepLoose<T[K]> | null }
    : T;

export function latestAudit(audits: AuditWithFindings[], type: AuditType): AuditWithFindings | null {
  // `audits` arrives ordered by created_at desc, so the first match is current.
  return audits.find((audit) => audit.audit_type === type) ?? null;
}

function readSummary<T>(audit: AuditWithFindings | null): DeepLoose<T> | null {
  if (!audit) return null;
  const summary = audit.summary as unknown;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null;
  return summary as DeepLoose<T>;
}

export function websiteSummary(audit: AuditWithFindings | null): DeepLoose<WebsiteAuditSummary> | null {
  return readSummary<WebsiteAuditSummary>(audit);
}

export function googleSummary(audit: AuditWithFindings | null): DeepLoose<GoogleBusinessAuditSummary> | null {
  return readSummary<GoogleBusinessAuditSummary>(audit);
}

export function instagramSummary(audit: AuditWithFindings | null): DeepLoose<InstagramAuditSummary> | null {
  return readSummary<InstagramAuditSummary>(audit);
}

export function performanceSummary(audit: AuditWithFindings | null): DeepLoose<PerformanceAuditSummary> | null {
  return readSummary<PerformanceAuditSummary>(audit);
}

export interface BenchmarkCompetitor {
  providerPlaceId: string;
  displayName: string;
  distanceM: number | null;
  metrics: DeepLoose<BenchmarkMetrics>;
}

/** competitor_benchmarks.competitors is stored as JSON; keep only usable rows. */
export function readCompetitors(value: Json | null): BenchmarkCompetitor[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as Record<string, unknown>) : null))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      providerPlaceId: typeof entry.providerPlaceId === "string" ? entry.providerPlaceId : "",
      displayName: typeof entry.displayName === "string" ? entry.displayName : "",
      distanceM: typeof entry.distanceM === "number" ? entry.distanceM : null,
      metrics:
        entry.metrics && typeof entry.metrics === "object" && !Array.isArray(entry.metrics)
          ? (entry.metrics as DeepLoose<BenchmarkMetrics>)
          : {},
    }))
    .filter((entry) => entry.displayName !== "");
}

export function readMetrics(value: Json | null): DeepLoose<BenchmarkMetrics> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as DeepLoose<BenchmarkMetrics>;
}

export function formatDate(value: string | null | undefined, locale: Locale): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(dateLocaleTag[locale], { dateStyle: "medium" }).format(date);
}

export function formatDateTime(value: string | null | undefined, locale: Locale): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(dateLocaleTag[locale], { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatNumber(value: number | null | undefined, locale: Locale, options?: Intl.NumberFormatOptions): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(dateLocaleTag[locale], options).format(value);
}

export function formatMoney(value: number | null | undefined, currency: string, locale: Locale): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(dateLocaleTag[locale], { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

/** Median review count of the benchmark set, used for a neutral statement. */
export function medianOf(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}
