import type { Locale } from "@/types/common";

const TAG: Record<Locale, string> = { tr: "tr-TR", en: "en-GB" };

export function formatNumber(value: number | null | undefined, locale: Locale = "tr", opts?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat(TAG[locale], opts).format(value);
}

export function formatCurrency(value: number | null | undefined, locale: Locale = "tr", currency = "TRY"): string {
  if (value === null || value === undefined) return "–";
  return new Intl.NumberFormat(TAG[locale], { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string | Date | null | undefined, locale: Locale = "tr", opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  if (!value) return "–";
  return new Intl.DateTimeFormat(TAG[locale], opts).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined, locale: Locale = "tr"): string {
  if (!value) return "–";
  return new Intl.DateTimeFormat(TAG[locale], { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatPercent(value: number | null | undefined, locale: Locale = "tr", fractionDigits = 0): string {
  if (value === null || value === undefined) return "–";
  return new Intl.NumberFormat(TAG[locale], { style: "percent", maximumFractionDigits: fractionDigits }).format(value);
}

export function formatDistance(meters: number | null | undefined, locale: Locale = "tr"): string {
  if (meters === null || meters === undefined) return "–";
  if (meters >= 1000) return `${formatNumber(meters / 1000, locale, { maximumFractionDigits: 1 })} km`;
  return `${Math.round(meters)} m`;
}

export function formatArea(km2: number | null | undefined, locale: Locale = "tr"): string {
  if (km2 === null || km2 === undefined) return "–";
  return `${formatNumber(km2, locale, { maximumFractionDigits: 2 })} km²`;
}

export function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
