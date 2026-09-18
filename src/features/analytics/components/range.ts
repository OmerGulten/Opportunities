/**
 * Date-range resolution shared by the analytics page (server) and its filter
 * bar (client).
 *
 * Deliberately free of `"use client"` and of React so both sides import the
 * exact same logic: the URL is the single source of truth for the range, and a
 * shared view must resolve to the same window wherever it is rendered.
 * Everything is computed in UTC so server and client agree.
 */

export const ANALYTICS_RANGE_PRESETS = ["d7", "d30", "d90", "d365", "custom"] as const;

export type AnalyticsRangePreset = (typeof ANALYTICS_RANGE_PRESETS)[number];

/**
 * Typed without `"custom"` on purpose: the fallback preset must always be a
 * fixed window, so it can index PRESET_DAYS directly.
 */
export const DEFAULT_ANALYTICS_PRESET: Exclude<AnalyticsRangePreset, "custom"> = "d30";

/** Inclusive day counts, so "last 7 days" covers today plus the previous six. */
const PRESET_DAYS: Record<Exclude<AnalyticsRangePreset, "custom">, number> = {
  d7: 7,
  d30: 30,
  d90: 90,
  d365: 365,
};

const DATE_INPUT = /^\d{4}-\d{2}-\d{2}$/;

export interface AnalyticsRange {
  preset: AnalyticsRangePreset;
  /** `yyyy-mm-dd`, for `<input type="date">` and for the URL. */
  fromDate: string;
  toDate: string;
  /** Inclusive ISO bounds handed to getAnalytics(). */
  fromIso: string;
  toIso: string;
}

export function isAnalyticsRangePreset(value: string | null | undefined): value is AnalyticsRangePreset {
  return typeof value === "string" && (ANALYTICS_RANGE_PRESETS as readonly string[]).includes(value);
}

export function isDateInput(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !DATE_INPUT.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

export function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDayIso(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function endOfDayIso(date: string): string {
  return `${date}T23:59:59.999Z`;
}

/**
 * Resolves the range from raw URL values. Unknown presets and malformed or
 * inverted dates fall back to the default window rather than throwing, because
 * these values arrive from a URL anyone can edit.
 */
export function resolveAnalyticsRange(
  input: { preset?: string | null; from?: string | null; to?: string | null },
  now: Date = new Date(),
): AnalyticsRange {
  const preset = isAnalyticsRangePreset(input.preset) ? input.preset : DEFAULT_ANALYTICS_PRESET;

  if (preset === "custom" && isDateInput(input.from) && isDateInput(input.to) && input.from <= input.to) {
    return {
      preset,
      fromDate: input.from,
      toDate: input.to,
      fromIso: startOfDayIso(input.from),
      toIso: endOfDayIso(input.to),
    };
  }

  const days = PRESET_DAYS[preset === "custom" ? DEFAULT_ANALYTICS_PRESET : preset];
  const toDate = toDateInput(now);
  const from = new Date(`${toDate}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  const fromDate = toDateInput(from);

  return {
    preset: preset === "custom" ? DEFAULT_ANALYTICS_PRESET : preset,
    fromDate,
    toDate,
    fromIso: startOfDayIso(fromDate),
    toIso: endOfDayIso(toDate),
  };
}

/** A uuid-shaped filter value from the URL, or undefined when absent/invalid. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function optionalId(value: string | string[] | null | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && UUID.test(raw) ? raw : undefined;
}

export function firstParam(value: string | string[] | null | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}
