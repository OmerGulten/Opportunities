import { describe, expect, it } from "vitest";

import { SIGNAL_TYPES, makeSignal, makeUnavailableSignal, type Signal } from "@/types/signals";

import { kadikoyRestaurantNoWebsiteSignals, strongWebsiteCafeSignals, weakWebsiteSeoGapsBasicSignals, weakWebsiteSeoGapsSignals } from "../../../tests/fixtures/signals";
import { DIGITAL_GAP_ORDER, deriveDigitalGaps } from "./gaps";

function google(signalType: string, value: Signal["value"], detectedAt = "2026-09-18T10:00:00.000Z"): Signal {
  return makeSignal(signalType, value, { source: "google_audit", confidence: "high", explanation: "test", detectedAt });
}

describe("deriveDigitalGaps", () => {
  it("fixture (a): no website, missing hours, few photos, incomplete profile", () => {
    const gaps = deriveDigitalGaps(kadikoyRestaurantNoWebsiteSignals);
    expect(gaps).toEqual(expect.arrayContaining(["no_website", "missing_hours", "few_photos", "google_incomplete"]));
    // 200 reviews and a 4.6 rating are not gaps; Instagram was not checked; no owner-reply data.
    expect(gaps).not.toContain("low_reviews");
    expect(gaps).not.toContain("low_rating");
    expect(gaps).not.toContain("no_instagram");
    expect(gaps).not.toContain("unanswered_reviews");
    expect(gaps).not.toContain("weak_website");
  });

  it("fixture (b): a strong presence has no gaps", () => {
    expect(deriveDigitalGaps(strongWebsiteCafeSignals)).toEqual([]);
  });

  it("fixture (c): weak website and slow mobile at deep depth, no slow_mobile when performance was not checked", () => {
    const deep = deriveDigitalGaps(weakWebsiteSeoGapsSignals);
    expect(deep).toContain("weak_website");
    expect(deep).toContain("slow_mobile");
    expect(deep).not.toContain("no_website");
    expect(deep).not.toContain("no_https");

    const basic = deriveDigitalGaps(weakWebsiteSeoGapsBasicSignals);
    expect(basic).toContain("weak_website");
    expect(basic).not.toContain("slow_mobile");
  });

  it("ignores not_checked / unavailable / error signals", () => {
    const signals: Signal[] = [
      makeUnavailableSignal(SIGNAL_TYPES.GOOGLE_HAS_OPENING_HOURS, { source: "google_audit", status: "not_checked", explanation: "test" }),
      makeUnavailableSignal(SIGNAL_TYPES.WEBSITE_STATUS, { source: "website_audit", status: "unavailable", explanation: "test" }),
      makeUnavailableSignal(SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, { source: "google_audit", status: "error", explanation: "test" }),
      // Even a suspicious value must not count when the observation did not happen.
      makeSignal(SIGNAL_TYPES.GOOGLE_RATING, 2.0, { source: "google_audit", status: "not_checked", explanation: "test" }),
    ];
    expect(deriveDigitalGaps(signals)).toEqual([]);
  });

  it("derives every gap from matching observed signals, in stable order", () => {
    const signals: Signal[] = [
      google(SIGNAL_TYPES.GOOGLE_RECENT_UNANSWERED_REVIEWS, 2),
      google(SIGNAL_TYPES.PERFORMANCE_MOBILE_SCORE, 49),
      google(SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, 4),
      google(SIGNAL_TYPES.GOOGLE_HAS_OPENING_HOURS, false),
      google(SIGNAL_TYPES.GOOGLE_RATING, 3.9),
      google(SIGNAL_TYPES.GOOGLE_REVIEW_COUNT, 9),
      google(SIGNAL_TYPES.GOOGLE_COMPLETENESS_SCORE, 59),
      google(SIGNAL_TYPES.INSTAGRAM_IS_ACTIVE, false),
      google(SIGNAL_TYPES.INSTAGRAM_STATUS, "not_found"),
      google(SIGNAL_TYPES.WEBSITE_HTTPS, "false"),
      google(SIGNAL_TYPES.WEBSITE_QUALITY, "weak"),
      google(SIGNAL_TYPES.WEBSITE_STATUS, "unreachable"),
    ];
    expect(deriveDigitalGaps(signals)).toEqual([...DIGITAL_GAP_ORDER]);
  });

  it("uses boundary values from the rules", () => {
    const signals: Signal[] = [
      google(SIGNAL_TYPES.GOOGLE_RECENT_UNANSWERED_REVIEWS, 1),
      google(SIGNAL_TYPES.PERFORMANCE_MOBILE_SCORE, 50),
      google(SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, 5),
      google(SIGNAL_TYPES.GOOGLE_RATING, 4),
      google(SIGNAL_TYPES.GOOGLE_REVIEW_COUNT, 10),
      google(SIGNAL_TYPES.GOOGLE_COMPLETENESS_SCORE, 60),
      google(SIGNAL_TYPES.WEBSITE_STATUS, "redirected"),
      google(SIGNAL_TYPES.WEBSITE_QUALITY, "average"),
    ];
    expect(deriveDigitalGaps(signals)).toEqual([]);
  });

  it("no_instagram needs medium or high confidence", () => {
    const low = makeSignal(SIGNAL_TYPES.INSTAGRAM_STATUS, "not_found", { source: "instagram_audit", confidence: "low", explanation: "test" });
    expect(deriveDigitalGaps([low])).toEqual([]);
    const medium = makeSignal(SIGNAL_TYPES.INSTAGRAM_STATUS, "not_found", { source: "instagram_audit", confidence: "medium", explanation: "test" });
    expect(deriveDigitalGaps([medium])).toEqual(["no_instagram"]);
  });

  it("accepts a value-less not_found observation for website and instagram", () => {
    const signals: Signal[] = [
      makeSignal(SIGNAL_TYPES.WEBSITE_STATUS, null, { source: "provider", status: "not_found", confidence: "high", explanation: "test" }),
      makeSignal(SIGNAL_TYPES.INSTAGRAM_STATUS, null, { source: "instagram_audit", status: "not_found", confidence: "high", explanation: "test" }),
    ];
    expect(deriveDigitalGaps(signals)).toEqual(["no_website", "no_instagram"]);
  });

  it("the latest duplicate signal wins", () => {
    const older = google(SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, 2, "2026-09-17T10:00:00.000Z");
    const newer = google(SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, 20, "2026-09-18T10:00:00.000Z");
    expect(deriveDigitalGaps([newer, older])).toEqual([]);
    expect(deriveDigitalGaps([older, newer])).toEqual([]);
    expect(deriveDigitalGaps([older])).toEqual(["few_photos"]);
  });
});
