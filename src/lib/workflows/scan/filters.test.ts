import { describe, expect, it } from "vitest";

import { scanFiltersSchema } from "@/features/scans/schemas";
import { makeSignal, makeUnavailableSignal, type Signal } from "@/types/signals";
import type { PlaceDetails } from "@/types/places";

import { passesPostAuditFilters, passesPreAuditFilters } from "./filters";

function details(overrides: Partial<PlaceDetails> = {}): PlaceDetails {
  return {
    provider: "demo",
    providerPlaceId: "demo_test",
    displayName: "Test İşletme",
    formattedAddress: "Kadıköy, İstanbul",
    location: { lat: 40.99, lng: 29.03 },
    primaryType: "restaurant",
    types: ["restaurant"],
    businessStatus: "OPERATIONAL",
    city: "İstanbul",
    district: "Kadıköy",
    countryCode: "TR",
    rating: 4.5,
    userRatingCount: 120,
    websiteUri: "https://example.demo-sites.example",
    phoneNational: "0216 000 00 00",
    phoneInternational: "+90 216 000 00 00",
    googleMapsUri: "https://maps.example/place",
    openingHours: { weekdayDescriptions: ["Pazartesi: 09:00-18:00"], periodsCount: 7 },
    photoCount: 8,
    priceLevel: null,
    reviewSample: null,
    socialProfiles: null,
    detailLevel: "basic",
    fieldMask: "test",
    fetchedAt: new Date("2026-09-18T00:00:00Z").toISOString(),
    ...overrides,
  };
}

const filters = (overrides: Record<string, unknown> = {}) => scanFiltersSchema.parse(overrides);

describe("passesPreAuditFilters", () => {
  it("passes everything when no filters are set", () => {
    expect(passesPreAuditFilters(details(), filters())).toBe(true);
  });

  it("does not filter at discovery depth, where the fields were never fetched", () => {
    // A discovery-depth result has no rating or website; treating that as
    // "missing" would silently drop every business.
    const bare = details({ websiteUri: null, rating: null, userRatingCount: null, openingHours: null, photoCount: null });
    expect(passesPreAuditFilters(bare, filters({ website: "none", minRating: 4 }), "discovery")).toBe(true);
  });

  it("matches businesses with no website when asked for none", () => {
    expect(passesPreAuditFilters(details({ websiteUri: null }), filters({ website: "none" }))).toBe(true);
    expect(passesPreAuditFilters(details(), filters({ website: "none" }))).toBe(false);
  });

  it("requires a website before a quality filter can apply", () => {
    expect(passesPreAuditFilters(details({ websiteUri: null }), filters({ website: "weak" }))).toBe(false);
    expect(passesPreAuditFilters(details(), filters({ website: "weak" }))).toBe(true);
  });

  it("applies rating bounds and treats an unknown rating as not matching a minimum", () => {
    expect(passesPreAuditFilters(details({ rating: 3.2 }), filters({ minRating: 4 }))).toBe(false);
    expect(passesPreAuditFilters(details({ rating: 4.6 }), filters({ minRating: 4 }))).toBe(true);
    expect(passesPreAuditFilters(details({ rating: 4.8 }), filters({ maxRating: 4.5 }))).toBe(false);
    expect(passesPreAuditFilters(details({ rating: null }), filters({ minRating: 4 }))).toBe(false);
  });

  it("applies review-count bounds", () => {
    expect(passesPreAuditFilters(details({ userRatingCount: 4 }), filters({ minReviews: 10 }))).toBe(false);
    expect(passesPreAuditFilters(details({ userRatingCount: 40 }), filters({ minReviews: 10 }))).toBe(true);
    expect(passesPreAuditFilters(details({ userRatingCount: 900 }), filters({ maxReviews: 500 }))).toBe(false);
  });

  it("applies google gap filters", () => {
    expect(passesPreAuditFilters(details({ openingHours: null }), filters({ google: ["missing_hours"] }))).toBe(true);
    expect(passesPreAuditFilters(details(), filters({ google: ["missing_hours"] }))).toBe(false);

    expect(passesPreAuditFilters(details({ photoCount: 1 }), filters({ google: ["missing_photos"] }))).toBe(true);
    expect(passesPreAuditFilters(details({ photoCount: 9 }), filters({ google: ["missing_photos"] }))).toBe(false);

    expect(passesPreAuditFilters(details({ websiteUri: null }), filters({ google: ["missing_website"] }))).toBe(true);
    expect(passesPreAuditFilters(details({ rating: 3.1 }), filters({ google: ["low_rating"] }))).toBe(true);
    expect(passesPreAuditFilters(details({ rating: 4.4 }), filters({ google: ["low_rating"] }))).toBe(false);
  });

  it("requires every selected gap to hold", () => {
    const business = details({ openingHours: null, photoCount: 9 });
    expect(passesPreAuditFilters(business, filters({ google: ["missing_hours"] }))).toBe(true);
    expect(passesPreAuditFilters(business, filters({ google: ["missing_hours", "missing_photos"] }))).toBe(false);
  });
});

describe("passesPostAuditFilters", () => {
  const quality = (value: string): Signal =>
    makeSignal("website.quality", value, { source: "website_audit", explanation: "test", evidenceType: "derived", confidence: "medium" });
  const instagram = (value: string): Signal =>
    makeSignal("instagram.status", value, { source: "instagram_audit", explanation: "test", confidence: "medium" });

  it("passes when no post-audit filter is set", () => {
    expect(passesPostAuditFilters([], filters())).toBe(true);
  });

  it("matches weak and average websites for the weak filter", () => {
    expect(passesPostAuditFilters([quality("weak")], filters({ website: "weak" }))).toBe(true);
    expect(passesPostAuditFilters([quality("average")], filters({ website: "weak" }))).toBe(true);
    expect(passesPostAuditFilters([quality("strong")], filters({ website: "weak" }))).toBe(false);
  });

  it("matches only strong websites for the strong filter", () => {
    expect(passesPostAuditFilters([quality("strong")], filters({ website: "strong" }))).toBe(true);
    expect(passesPostAuditFilters([quality("weak")], filters({ website: "strong" }))).toBe(false);
  });

  it("rejects a quality filter when the signal is unavailable rather than guessing", () => {
    const unavailable = makeUnavailableSignal("website.quality", { source: "website_audit", explanation: "not audited" });
    expect(passesPostAuditFilters([unavailable], filters({ website: "weak" }))).toBe(false);
    expect(passesPostAuditFilters([], filters({ website: "weak" }))).toBe(false);
  });

  it("distinguishes instagram not_found from not_checked", () => {
    expect(passesPostAuditFilters([instagram("not_found")], filters({ instagram: "not_found" }))).toBe(true);
    expect(passesPostAuditFilters([instagram("not_checked")], filters({ instagram: "not_found" }))).toBe(false);
    expect(passesPostAuditFilters([instagram("not_checked")], filters({ instagram: "not_checked" }))).toBe(true);
    expect(passesPostAuditFilters([instagram("found")], filters({ instagram: "found" }))).toBe(true);
  });

  it("applies the derived google completeness filter", () => {
    const score = (value: number) =>
      makeSignal("google.completeness_score", value, { source: "google_audit", explanation: "test", evidenceType: "derived" });
    expect(passesPostAuditFilters([score(45)], filters({ google: ["incomplete"] }))).toBe(true);
    expect(passesPostAuditFilters([score(85)], filters({ google: ["incomplete"] }))).toBe(false);
  });
});
