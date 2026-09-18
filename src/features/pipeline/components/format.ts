import { dateLocaleTag } from "@/lib/i18n";
import type { Locale } from "@/types/common";

/**
 * Server-side date presentation.
 *
 * Dates are formatted once, on the server, and shipped as strings. Formatting
 * the same instant again in the browser would use the visitor's time zone and
 * produce different text from the server render, which React reports as a
 * hydration mismatch; printing a ready string avoids that class of bug.
 */
export function formatDate(iso: string | null | undefined, locale: Locale): string | null {
  if (!iso) return null;
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return null;
  return new Intl.DateTimeFormat(dateLocaleTag[locale], { dateStyle: "medium" }).format(value);
}

export function formatDateTime(iso: string | null | undefined, locale: Locale): string | null {
  if (!iso) return null;
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return null;
  return new Intl.DateTimeFormat(dateLocaleTag[locale], { dateStyle: "medium", timeStyle: "short" }).format(value);
}

export function formatMoney(amount: number | null | undefined, currency: string, locale: Locale): string | null {
  if (amount === null || amount === undefined) return null;
  return new Intl.NumberFormat(dateLocaleTag[locale], { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

/** True when a reminder's moment has passed. Evaluated once, on the server. */
export function isDue(iso: string | null | undefined, now: number = Date.now()): boolean {
  if (!iso) return false;
  const value = new Date(iso).getTime();
  return !Number.isNaN(value) && value <= now;
}
