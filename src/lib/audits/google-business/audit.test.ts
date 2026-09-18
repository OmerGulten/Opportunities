import { describe, expect, it } from "vitest";

import { DETAILS_MASK_BY_DEPTH } from "@/lib/providers/places/field-masks";
import type { PlaceDetails } from "@/types/places";
import type { Signal } from "@/types/signals";

import { auditGoogleBusiness } from "./audit";

const NOW = new Date("2026-06-01T12:00:00.000Z");

function details(overrides: Partial<PlaceDetails> = {}): PlaceDetails {
  return {
    provider: "google_places",
    providerPlaceId: "places/abc",
    displayName: "Deniz Restoran Kadıköy",
    formattedAddress: "Caferağa Mah. Moda Cad. No:12, Kadıköy",
    location: { lat: 40.98, lng: 29.03 },
    primaryType: "restaurant",
    types: ["restaurant"],
    businessStatus: "OPERATIONAL",
    city: "İstanbul",
    district: "Kadıköy",
    countryCode: "TR",
    rating: 4.6,
    userRatingCount: 148,
    websiteUri: "https://denizrestoran.com",
    phoneNational: "0216 123 45 67",
    phoneInternational: "+90 216 123 45 67",
    googleMapsUri: "https://maps.google.com/?cid=1",
    openingHours: { weekdayDescriptions: ["Pazartesi: 12:00-23:00"], periodsCount: 7 },
    photoCount: 8,
    priceLevel: "PRICE_LEVEL_MODERATE",
    reviewSample: null,
    socialProfiles: null,
    detailLevel: "basic",
    fieldMask: DETAILS_MASK_BY_DEPTH.basic,
    fetchedAt: NOW.toISOString(),
    ...overrides,
  };
}

function index(signals: readonly Signal[]): Map<string, Signal> {
  return new Map(signals.map((signal) => [signal.signalType, signal]));
}

describe("auditGoogleBusiness review sampling", () => {
  it("marks every review signal unavailable when the provider hides owner replies", () => {
    const outcome = auditGoogleBusiness(
      details({
        detailLevel: "deep",
        fieldMask: DETAILS_MASK_BY_DEPTH.deep,
        reviewSample: [
          { rating: 5, relativeTime: "1 hafta önce", publishTime: "2026-05-25T10:00:00.000Z", hasOwnerReply: null },
          { rating: 3, relativeTime: "1 ay önce", publishTime: "2026-05-01T10:00:00.000Z", hasOwnerReply: null },
        ],
      }),
      { locale: "tr", now: NOW },
    );

    const signals = index(outcome.signals);
    for (const type of ["google.review_response_rate", "google.recent_unanswered_reviews", "google.review_sample_size"]) {
      expect(signals.get(type)).toMatchObject({ status: "unavailable", evidenceType: "unavailable", value: null });
    }
    expect(outcome.summary.reviewSample).toBeNull();
    const finding = outcome.findings.find((entry) => entry.key === "google_review_responses_unavailable");
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("info");
    expect(finding?.status).toBe("unavailable");
  });

  it("emits a low-confidence response rate when replies are known", () => {
    const outcome = auditGoogleBusiness(
      details({
        detailLevel: "deep",
        fieldMask: DETAILS_MASK_BY_DEPTH.deep,
        reviewSample: [
          { rating: 5, relativeTime: "1 hafta önce", publishTime: "2026-05-25T10:00:00.000Z", hasOwnerReply: true },
          { rating: 2, relativeTime: "2 hafta önce", publishTime: "2026-05-18T10:00:00.000Z", hasOwnerReply: false },
          { rating: 4, relativeTime: "1 ay önce", publishTime: "2026-05-02T10:00:00.000Z", hasOwnerReply: false },
          { rating: 1, relativeTime: "1 yıl önce", publishTime: "2025-05-02T10:00:00.000Z", hasOwnerReply: false },
        ],
      }),
      { locale: "tr", now: NOW },
    );

    const signals = index(outcome.signals);
    const rate = signals.get("google.review_response_rate");
    expect(rate).toMatchObject({ value: 0.25, status: "found", evidenceType: "observed", confidence: "low" });
    expect(rate?.explanation).toContain("4");
    expect(signals.get("google.recent_unanswered_reviews")).toMatchObject({ value: 2, confidence: "low" });
    expect(signals.get("google.review_sample_size")).toMatchObject({ value: 4 });
    expect(outcome.summary.reviewSample).toMatchObject({ size: 4, withOwnerReply: 1, responseRate: 0.25, recentUnanswered: 2, confidence: "low" });
    const finding = outcome.findings.find((entry) => entry.key === "google_low_response_rate");
    expect(finding?.confidence).toBe("low");
  });
});

describe("auditGoogleBusiness field-mask honesty", () => {
  it("does not claim missing fields that were never requested", () => {
    const outcome = auditGoogleBusiness(
      details({
        detailLevel: "discovery",
        fieldMask: DETAILS_MASK_BY_DEPTH.discovery,
        rating: null,
        userRatingCount: null,
        websiteUri: null,
        phoneNational: null,
        phoneInternational: null,
        openingHours: null,
        photoCount: null,
      }),
      { locale: "tr", now: NOW },
    );

    const signals = index(outcome.signals);
    for (const type of [
      "google.rating",
      "google.review_count",
      "google.has_opening_hours",
      "google.photo_count",
      "google.has_website",
      "google.has_phone",
      "google.completeness_score",
      "google.profile_completeness",
    ]) {
      expect(signals.get(type)).toMatchObject({ status: "not_checked", evidenceType: "unavailable" });
    }
    expect(outcome.summary.hasOpeningHours).toBeNull();
    expect(outcome.summary.photoCount).toBeNull();
    expect(outcome.findings.map((finding) => finding.key)).not.toContain("google_missing_website");
    expect(outcome.findings.map((finding) => finding.key)).not.toContain("google_missing_hours");
  });

  it("reports an actually empty field as not_found", () => {
    const outcome = auditGoogleBusiness(
      details({ websiteUri: null, phoneNational: null, phoneInternational: null, openingHours: null, photoCount: 2, rating: 3.4, userRatingCount: 6 }),
      { locale: "tr", now: NOW },
    );

    const signals = index(outcome.signals);
    expect(signals.get("google.has_website")).toMatchObject({ value: false, status: "found", confidence: "high" });
    expect(signals.get("google.has_phone")).toMatchObject({ value: false, status: "found" });
    expect(signals.get("google.has_opening_hours")).toMatchObject({ value: false, status: "found" });
    expect(signals.get("google.photo_count")).toMatchObject({ value: 2, confidence: "medium" });
    expect(signals.get("google.photo_count")?.explanation).toContain("10");
    // rating present (10) + address present (10); website, phone, hours and photos all score zero.
    expect(signals.get("google.completeness_score")).toMatchObject({ value: 20, evidenceType: "derived" });
    expect(signals.get("google.profile_completeness")).toMatchObject({ value: "incomplete" });

    const keys = outcome.findings.map((finding) => finding.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "google_missing_website",
        "google_missing_phone",
        "google_missing_hours",
        "google_few_photos",
        "google_low_review_count",
        "google_low_rating",
        "google_incomplete_profile",
      ]),
    );
    expect(outcome.summary.missingFields).toEqual(expect.arrayContaining(["website", "phone", "opening_hours", "photos"]));
  });

  it("flags a profile that is not operational as information", () => {
    const outcome = auditGoogleBusiness(details({ businessStatus: "CLOSED_TEMPORARILY" }), { locale: "tr", now: NOW });
    const finding = outcome.findings.find((entry) => entry.key === "google_not_operational");
    expect(finding?.severity).toBe("info");
    expect(finding?.evidence.businessStatus).toBe("CLOSED_TEMPORARILY");
    expect(index(outcome.signals).get("google.business_status")).toMatchObject({ value: "CLOSED_TEMPORARILY" });
  });

  it("produces a complete profile with no gap findings", () => {
    const outcome = auditGoogleBusiness(details(), { locale: "tr", now: NOW });
    expect(outcome.summary.completenessScore).toBe(100);
    expect(outcome.summary.completeness).toBe("complete");
    expect(outcome.summary.missingFields).toEqual([]);
    expect(outcome.findings.map((finding) => finding.key)).toEqual(["google_review_responses_unavailable"]);
    expect(outcome.status).toBe("completed");
  });
});
