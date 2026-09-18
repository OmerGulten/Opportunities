import type { DigitalGap } from "@/types/scoring";
import { SIGNAL_TYPES, type Signal } from "@/types/signals";

import { coerceBoolean, coerceNumber } from "./operators";
import { indexSignalsByType, isEvaluableSignal } from "./signal-index";

/** Stable display order for gap badges. `deriveDigitalGaps` returns gaps in this order. */
export const DIGITAL_GAP_ORDER: readonly DigitalGap[] = [
  "no_website",
  "weak_website",
  "no_https",
  "no_instagram",
  "inactive_instagram",
  "google_incomplete",
  "low_reviews",
  "low_rating",
  "missing_hours",
  "few_photos",
  "slow_mobile",
  "unanswered_reviews",
] as const;

const NO_WEBSITE_STATUSES: ReadonlySet<string> = new Set(["not_found", "invalid", "unreachable"]);

/**
 * Quick "digital gap" badges derived from observed signals only.
 *
 * Signals with status `not_checked` / `unavailable` / `error` are ignored, so a
 * gap is never shown for something that was not actually checked. Thresholds
 * mirror the default service rules in supabase/seed.sql.
 */
export function deriveDigitalGaps(signals: readonly Signal[]): DigitalGap[] {
  const index = indexSignalsByType(signals.filter(isEvaluableSignal));
  const get = (type: string): Signal | undefined => index.get(type);
  const num = (type: string): number | null => {
    const signal = get(type);
    return signal ? coerceNumber(signal.value) : null;
  };
  const bool = (type: string): boolean | null => {
    const signal = get(type);
    return signal ? coerceBoolean(signal.value) : null;
  };

  const found = new Set<DigitalGap>();

  // A website check that concluded "none / invalid / unreachable". Audits may
  // encode the outcome either in the value or (value-less) in the status.
  const website = get(SIGNAL_TYPES.WEBSITE_STATUS);
  if (website && ((typeof website.value === "string" && NO_WEBSITE_STATUSES.has(website.value)) || (website.status === "not_found" && website.value === null))) {
    found.add("no_website");
  }

  if (get(SIGNAL_TYPES.WEBSITE_QUALITY)?.value === "weak") found.add("weak_website");
  if (bool(SIGNAL_TYPES.WEBSITE_HTTPS) === false) found.add("no_https");

  const instagram = get(SIGNAL_TYPES.INSTAGRAM_STATUS);
  if (instagram && (instagram.value === "not_found" || (instagram.status === "not_found" && instagram.value === null)) && (instagram.confidence === "medium" || instagram.confidence === "high")) {
    found.add("no_instagram");
  }
  if (bool(SIGNAL_TYPES.INSTAGRAM_IS_ACTIVE) === false) found.add("inactive_instagram");

  const completeness = num(SIGNAL_TYPES.GOOGLE_COMPLETENESS_SCORE);
  if (completeness !== null && completeness < 60) found.add("google_incomplete");

  const reviewCount = num(SIGNAL_TYPES.GOOGLE_REVIEW_COUNT);
  if (reviewCount !== null && reviewCount < 10) found.add("low_reviews");

  const rating = num(SIGNAL_TYPES.GOOGLE_RATING);
  if (rating !== null && rating < 4) found.add("low_rating");

  if (bool(SIGNAL_TYPES.GOOGLE_HAS_OPENING_HOURS) === false) found.add("missing_hours");

  const photoCount = num(SIGNAL_TYPES.GOOGLE_PHOTO_COUNT);
  if (photoCount !== null && photoCount < 5) found.add("few_photos");

  const mobileScore = num(SIGNAL_TYPES.PERFORMANCE_MOBILE_SCORE);
  if (mobileScore !== null && mobileScore < 50) found.add("slow_mobile");

  const unanswered = num(SIGNAL_TYPES.GOOGLE_RECENT_UNANSWERED_REVIEWS);
  if (unanswered !== null && unanswered >= 2) found.add("unanswered_reviews");

  return DIGITAL_GAP_ORDER.filter((gap) => found.has(gap));
}
