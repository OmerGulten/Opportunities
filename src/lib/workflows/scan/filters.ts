import type { ScanFilters } from "@/features/scans/schemas";
import type { AuditDepth } from "@/types/common";
import type { PlaceDetails } from "@/types/places";
import type { Signal } from "@/types/signals";

/**
 * Scan result filters.
 *
 * Split in two on purpose: the cheap checks run on the provider profile before
 * the expensive website and Instagram work, so a scan does not pay to audit
 * businesses the user already excluded. The rest need audit signals and run
 * after.
 *
 * Pure functions with no I/O, so the rules that decide what a user is charged
 * for are directly testable.
 */

/**
 * Filters decidable from the provider profile alone.
 *
 * At `discovery` depth the provider was never asked for rating, website, hours
 * or photos, so those fields are unknown rather than absent. Filtering on
 * unknown data would silently drop every business, so discovery scans skip
 * these checks and the filters apply in the results view instead.
 */
export function passesPreAuditFilters(details: PlaceDetails, filters: Partial<ScanFilters>, depth: AuditDepth = "basic"): boolean {
  if (depth === "discovery") return true;

  const hasWebsite = Boolean(details.websiteUri);
  if (filters.website === "none" && hasWebsite) return false;
  // "weak" and "strong" are decided after the website audit, but both require
  // a website to exist at all.
  if ((filters.website === "weak" || filters.website === "strong") && !hasWebsite) return false;

  const rating = details.rating;
  if (isNumber(filters.minRating) && (rating === null || rating < filters.minRating)) return false;
  if (isNumber(filters.maxRating) && rating !== null && rating > filters.maxRating) return false;

  const reviews = details.userRatingCount;
  if (isNumber(filters.minReviews) && (reviews === null || reviews < filters.minReviews)) return false;
  if (isNumber(filters.maxReviews) && reviews !== null && reviews > filters.maxReviews) return false;

  for (const gap of filters.google ?? []) {
    if (gap === "missing_website" && hasWebsite) return false;
    if (gap === "missing_hours" && details.openingHours !== null) return false;
    if (gap === "missing_photos" && (details.photoCount ?? 0) >= 5) return false;
    if (gap === "low_reviews" && (reviews ?? 0) >= 10) return false;
    if (gap === "low_rating" && (rating ?? 0) >= 4) return false;
  }
  return true;
}

/** Filters that need audit signals: website quality and Instagram presence. */
export function passesPostAuditFilters(signals: readonly Signal[], filters: Partial<ScanFilters>): boolean {
  const byType = new Map(signals.map((signal) => [signal.signalType, signal]));

  if (filters.website === "weak" || filters.website === "strong") {
    const quality = byType.get("website.quality");
    // An unaudited or unavailable quality signal cannot satisfy a quality filter.
    if (!quality || quality.status !== "found") return false;
    if (filters.website === "weak" && quality.value !== "weak" && quality.value !== "average") return false;
    if (filters.website === "strong" && quality.value !== "strong") return false;
  }

  if (filters.instagram && filters.instagram !== "any") {
    const value = byType.get("instagram.status")?.value;
    if (filters.instagram === "found" && value !== "found") return false;
    if (filters.instagram === "not_found" && value !== "not_found") return false;
    if (filters.instagram === "not_checked" && value !== "not_checked") return false;
  }

  // The other Google gaps were already applied pre-audit; "incomplete" needs the
  // derived completeness score.
  if ((filters.google ?? []).includes("incomplete")) {
    const completeness = byType.get("google.completeness_score");
    if (typeof completeness?.value === "number" && completeness.value >= 60) return false;
  }
  return true;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
