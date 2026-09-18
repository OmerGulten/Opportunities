import { createFindingCollector } from "@/lib/audits/finding";
import { createSignalFactory } from "@/lib/audits/signal";
import type { AuditOutcome, GoogleBusinessAuditSummary } from "@/types/audits";
import type { Locale } from "@/types/common";
import type { PlaceDetails, PlaceReviewSample } from "@/types/places";
import { SIGNAL_TYPES, type Signal } from "@/types/signals";

/**
 * Google Business Profile audit. Works purely from the provider payload that was
 * already paid for: no extra calls, no scraping.
 *
 * Two honesty rules shape this file:
 *  - a field outside the requested field mask is `not_checked`, never `false`;
 *  - Google Places API (New) does not expose owner replies, so review response
 *    signals are `unavailable` unless the provider actually filled
 *    `reviewSample[].hasOwnerReply`, and even then they are low confidence
 *    because the sample is at most five reviews.
 */

const SOURCE = "provider";
const PHOTO_TARGET = 5;
const LOW_REVIEW_COUNT = 10;
const LOW_RATING = 4;
const LOW_RESPONSE_RATE = 0.3;
const RECENT_REVIEW_DAYS = 90;
const INCOMPLETE_SCORE = 60;
const COMPLETE_SCORE = 80;
/** Google Places API (New) returns at most 10 photo references per place. */
export const PROVIDER_PHOTO_CAP = 10;

export interface GoogleBusinessAuditOptions {
  locale: Locale;
  /** Overrides "now" for the recent-review window (tests). */
  now?: Date;
}

/** True when the provider actually requested this field (it is inside the field mask). */
export function providerFieldChecked(details: PlaceDetails, field: string): boolean {
  const mask = details.fieldMask ?? "";
  if (mask.trim() === "") {
    // No mask recorded: fall back to the depth the provider says it fetched.
    return details.detailLevel !== "discovery";
  }
  return mask.split(",").some((entry) => entry.trim() === field || entry.trim() === `places.${field}`);
}

export function summarizeReviewSample(
  sample: readonly PlaceReviewSample[] | null,
  now: Date,
): { size: number; withOwnerReply: number; responseRate: number | null; recentUnanswered: number; usable: boolean } {
  if (sample === null || sample.length === 0) {
    return { size: 0, withOwnerReply: 0, responseRate: null, recentUnanswered: 0, usable: false };
  }
  const known = sample.filter((review) => review.hasOwnerReply !== null);
  if (known.length === 0) {
    return { size: sample.length, withOwnerReply: 0, responseRate: null, recentUnanswered: 0, usable: false };
  }
  const withOwnerReply = known.filter((review) => review.hasOwnerReply === true).length;
  const cutoff = now.getTime() - RECENT_REVIEW_DAYS * 24 * 60 * 60 * 1000;
  const recentUnanswered = known.filter((review) => {
    if (review.hasOwnerReply !== false || review.publishTime === null) return false;
    const published = Date.parse(review.publishTime);
    return !Number.isNaN(published) && published >= cutoff;
  }).length;
  return {
    size: known.length,
    withOwnerReply,
    responseRate: Math.round((withOwnerReply / known.length) * 100) / 100,
    recentUnanswered,
    usable: true,
  };
}

export function auditGoogleBusiness(details: PlaceDetails, opts: GoogleBusinessAuditOptions): AuditOutcome<GoogleBusinessAuditSummary> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const signals = createSignalFactory(opts.locale, "google_audit");
  const collector = createFindingCollector(opts.locale, SOURCE);
  const emitted: Signal[] = [];

  const ratingChecked = providerFieldChecked(details, "rating");
  const reviewCountChecked = providerFieldChecked(details, "userRatingCount");
  const websiteChecked = providerFieldChecked(details, "websiteUri");
  const phoneChecked = providerFieldChecked(details, "nationalPhoneNumber") || providerFieldChecked(details, "internationalPhoneNumber");
  const hoursChecked = providerFieldChecked(details, "regularOpeningHours");
  const photosChecked = providerFieldChecked(details, "photos");
  const reviewsChecked = providerFieldChecked(details, "reviews");

  const hasWebsite = details.websiteUri !== null && details.websiteUri.trim() !== "";
  const hasPhone = (details.phoneNational ?? details.phoneInternational ?? "").trim() !== "";
  const hasAddress = details.formattedAddress !== null && details.formattedAddress.trim() !== "";
  const hasOpeningHours =
    details.openingHours === null ? false : details.openingHours.periodsCount > 0 || details.openingHours.weekdayDescriptions.length > 0;
  const photoCount = details.photoCount;

  // ---- rating / reviews ---------------------------------------------------
  if (ratingChecked) {
    emitted.push(
      details.rating === null
        ? signals.emit(SIGNAL_TYPES.GOOGLE_RATING, null, { status: "not_found", confidence: "high" })
        : signals.emit(SIGNAL_TYPES.GOOGLE_RATING, details.rating, { confidence: "high" }),
    );
  } else {
    emitted.push(signals.unavailable(SIGNAL_TYPES.GOOGLE_RATING, "google_field_not_requested"));
  }

  if (reviewCountChecked) {
    emitted.push(signals.emit(SIGNAL_TYPES.GOOGLE_REVIEW_COUNT, details.userRatingCount ?? 0, { confidence: "high" }));
  } else {
    emitted.push(signals.unavailable(SIGNAL_TYPES.GOOGLE_REVIEW_COUNT, "google_field_not_requested"));
  }

  // ---- profile fields -----------------------------------------------------
  emitted.push(
    hoursChecked
      ? signals.emit(SIGNAL_TYPES.GOOGLE_HAS_OPENING_HOURS, hasOpeningHours, { confidence: "high" })
      : signals.unavailable(SIGNAL_TYPES.GOOGLE_HAS_OPENING_HOURS, "google_field_not_requested"),
  );
  emitted.push(
    photosChecked
      ? signals.emit(SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, photoCount ?? 0, { confidence: "medium", params: { cap: PROVIDER_PHOTO_CAP } })
      : signals.unavailable(SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, "google_field_not_requested"),
  );
  emitted.push(
    websiteChecked
      ? signals.emit(SIGNAL_TYPES.GOOGLE_HAS_WEBSITE, hasWebsite, { confidence: "high" })
      : signals.unavailable(SIGNAL_TYPES.GOOGLE_HAS_WEBSITE, "google_field_not_requested"),
  );
  emitted.push(
    phoneChecked
      ? signals.emit(SIGNAL_TYPES.GOOGLE_HAS_PHONE, hasPhone, { confidence: "high" })
      : signals.unavailable(SIGNAL_TYPES.GOOGLE_HAS_PHONE, "google_field_not_requested"),
  );
  emitted.push(
    details.businessStatus === null
      ? signals.unavailable(SIGNAL_TYPES.GOOGLE_BUSINESS_STATUS, "google_field_not_requested")
      : signals.emit(SIGNAL_TYPES.GOOGLE_BUSINESS_STATUS, details.businessStatus, { confidence: "high" }),
  );

  // ---- completeness -------------------------------------------------------
  const components: Array<{ key: string; weight: number; value: boolean; checked: boolean }> = [
    { key: "website", weight: 25, value: hasWebsite, checked: websiteChecked },
    { key: "phone", weight: 20, value: hasPhone, checked: phoneChecked },
    { key: "opening_hours", weight: 20, value: hasOpeningHours, checked: hoursChecked },
    { key: "photos", weight: 15, value: (photoCount ?? 0) >= PHOTO_TARGET, checked: photosChecked },
    { key: "rating", weight: 10, value: details.rating !== null, checked: ratingChecked },
    { key: "address", weight: 10, value: hasAddress, checked: true },
  ];
  const allChecked = components.every((component) => component.checked);
  // Unknown components score zero: the number in the summary is a floor, and the
  // signal below is emitted as "not checked" whenever anything was unknown.
  const completenessScore = components.reduce((sum, component) => sum + (component.checked && component.value ? component.weight : 0), 0);
  const missingFields = components.filter((component) => component.checked && !component.value).map((component) => component.key);
  const completeness: GoogleBusinessAuditSummary["completeness"] = completenessScore >= COMPLETE_SCORE ? "complete" : "incomplete";

  if (allChecked) {
    emitted.push(signals.emit(SIGNAL_TYPES.GOOGLE_COMPLETENESS_SCORE, completenessScore, { evidenceType: "derived", confidence: "medium" }));
    emitted.push(signals.emit(SIGNAL_TYPES.GOOGLE_PROFILE_COMPLETENESS, completeness, { evidenceType: "derived", confidence: "medium" }));
  } else {
    emitted.push(signals.unavailable(SIGNAL_TYPES.GOOGLE_COMPLETENESS_SCORE, "google_field_not_requested"));
    emitted.push(signals.unavailable(SIGNAL_TYPES.GOOGLE_PROFILE_COMPLETENESS, "google_field_not_requested"));
  }

  // ---- review sample ------------------------------------------------------
  const sample = summarizeReviewSample(details.reviewSample, now);
  if (sample.usable && sample.responseRate !== null) {
    emitted.push(
      signals.emit(SIGNAL_TYPES.GOOGLE_REVIEW_RESPONSE_RATE, sample.responseRate, {
        confidence: "low",
        params: { size: sample.size, withReply: sample.withOwnerReply },
      }),
    );
    emitted.push(
      signals.emit(SIGNAL_TYPES.GOOGLE_RECENT_UNANSWERED_REVIEWS, sample.recentUnanswered, {
        confidence: "low",
        params: { days: RECENT_REVIEW_DAYS, size: sample.size },
      }),
    );
    emitted.push(signals.emit(SIGNAL_TYPES.GOOGLE_REVIEW_SAMPLE_SIZE, sample.size, { confidence: "high" }));
  } else {
    for (const type of [SIGNAL_TYPES.GOOGLE_REVIEW_RESPONSE_RATE, SIGNAL_TYPES.GOOGLE_RECENT_UNANSWERED_REVIEWS, SIGNAL_TYPES.GOOGLE_REVIEW_SAMPLE_SIZE]) {
      emitted.push(signals.unavailable(type, reviewsChecked ? "google_no_owner_replies" : "google_field_not_requested", { status: "unavailable" }));
    }
  }

  // ---- findings -----------------------------------------------------------
  if (hoursChecked && !hasOpeningHours) {
    collector.add({ key: "google_missing_hours", category: "google", severity: "high", status: "not_found", confidence: "high", evidence: {} });
  }
  if (photosChecked && (photoCount ?? 0) < PHOTO_TARGET) {
    collector.add({
      key: "google_few_photos",
      category: "google",
      severity: "medium",
      confidence: "medium",
      evidence: { photoCount: photoCount ?? 0, cap: PROVIDER_PHOTO_CAP },
      params: { count: photoCount ?? 0, target: PHOTO_TARGET, cap: PROVIDER_PHOTO_CAP },
    });
  }
  if (phoneChecked && !hasPhone) {
    collector.add({ key: "google_missing_phone", category: "google", severity: "high", status: "not_found", confidence: "high", evidence: {} });
  }
  if (websiteChecked && !hasWebsite) {
    collector.add({ key: "google_missing_website", category: "google", severity: "high", status: "not_found", confidence: "high", evidence: {} });
  }
  if (reviewCountChecked && (details.userRatingCount ?? 0) < LOW_REVIEW_COUNT) {
    collector.add({
      key: "google_low_review_count",
      category: "google",
      severity: "medium",
      confidence: "high",
      evidence: { reviewCount: details.userRatingCount ?? 0 },
      params: { count: details.userRatingCount ?? 0, target: LOW_REVIEW_COUNT },
    });
  }
  if (ratingChecked && details.rating !== null && details.rating < LOW_RATING) {
    collector.add({
      key: "google_low_rating",
      category: "google",
      severity: "medium",
      confidence: "high",
      evidence: { rating: details.rating },
      params: { rating: details.rating, target: LOW_RATING },
    });
  }
  if (allChecked && completenessScore < INCOMPLETE_SCORE) {
    collector.add({
      key: "google_incomplete_profile",
      category: "google",
      severity: "medium",
      evidenceType: "derived",
      confidence: "medium",
      evidence: { completenessScore, missingFields },
      params: { score: completenessScore },
    });
  }
  if (!sample.usable) {
    collector.add({
      key: "google_review_responses_unavailable",
      category: "google",
      severity: "info",
      status: "unavailable",
      evidenceType: "unavailable",
      confidence: "low",
      evidence: { reviewsRequested: reviewsChecked, sampleSize: details.reviewSample?.length ?? 0 },
    });
  } else if (sample.responseRate !== null && sample.responseRate < LOW_RESPONSE_RATE) {
    collector.add({
      key: "google_low_response_rate",
      category: "google",
      severity: "medium",
      confidence: "low",
      evidence: { responseRate: sample.responseRate, sampleSize: sample.size, recentUnanswered: sample.recentUnanswered },
      params: { rate: Math.round(sample.responseRate * 100), size: sample.size },
    });
  }
  if (details.businessStatus !== null && details.businessStatus !== "OPERATIONAL") {
    collector.add({
      key: "google_not_operational",
      category: "google",
      severity: "info",
      confidence: "high",
      evidence: { businessStatus: details.businessStatus },
      params: { status: details.businessStatus },
    });
  }

  const summary: GoogleBusinessAuditSummary = {
    rating: ratingChecked ? details.rating : null,
    reviewCount: reviewCountChecked ? details.userRatingCount : null,
    hasOpeningHours: hoursChecked ? hasOpeningHours : null,
    photoCount: photosChecked ? (photoCount ?? 0) : null,
    hasWebsite,
    hasPhone,
    hasAddress,
    businessStatus: details.businessStatus,
    completenessScore,
    completeness,
    missingFields,
    reviewSample: sample.usable
      ? {
          size: sample.size,
          withOwnerReply: sample.withOwnerReply,
          responseRate: sample.responseRate,
          recentUnanswered: sample.recentUnanswered,
          confidence: "low",
        }
      : null,
    mapsUrl: details.googleMapsUri,
  };

  return {
    auditType: "google_business",
    status: "completed",
    observation: "found",
    source: SOURCE,
    summary,
    findings: collector.findings,
    signals: emitted,
    durationMs: Date.now() - started,
  };
}
