import { getT } from "@/lib/i18n";
import type { Locale, ObservationStatus } from "@/types/common";
import type { WebsiteStatus } from "@/types/signals";

/**
 * Localized labels for the explicit status values carried in
 * VerifiedBusinessFacts. Unknown values are returned unchanged (they may
 * already be labels produced upstream); we never guess.
 */
const WEBSITE_STATUSES: ReadonlySet<string> = new Set<WebsiteStatus>(["found", "not_found", "unreachable", "redirected", "invalid", "not_checked"]);
const OBSERVATION_STATUSES: ReadonlySet<string> = new Set<ObservationStatus>(["found", "not_found", "not_checked", "unavailable", "error", "ambiguous"]);

export function isWebsiteStatus(value: string): value is WebsiteStatus {
  return WEBSITE_STATUSES.has(value);
}

export function isObservationStatus(value: string): value is ObservationStatus {
  return OBSERVATION_STATUSES.has(value);
}

export function websiteStatusLabel(status: string, locale: Locale): string {
  return isWebsiteStatus(status) ? getT(locale, "common")(`websiteStatus.${status}`) : status;
}

export function observationStatusLabel(status: string, locale: Locale): string {
  return isObservationStatus(status) ? getT(locale, "common")(`observation.${status}`) : status;
}

/** Statuses that mean "we do not know", used for cautions. */
export function isUnknownStatus(status: string): boolean {
  return status === "not_checked" || status === "unavailable" || status === "error" || status === "ambiguous" || status === "unreachable" || status === "invalid";
}
