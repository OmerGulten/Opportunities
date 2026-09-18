import { describe, expect, it } from "vitest";

import { DETAILS_MASK_BY_DEPTH } from "@/lib/providers/places/field-masks";
import type { BenchmarkMetrics } from "@/types/audits";
import type { PlaceDetails } from "@/types/places";

import { buildCompetitorBenchmark, metricsFromDetails } from "./benchmark";

const JUDGEMENT_WORDS = /\b(better|worse|best|worst|leader|behind|ahead|daha iyi|daha kötü|en iyi|en kötü|geride|önde|lider)\b/i;

function metrics(overrides: Partial<BenchmarkMetrics> = {}): BenchmarkMetrics {
  return {
    hasWebsite: true,
    websiteQuality: "average",
    rating: 4.2,
    reviewCount: 40,
    hasInstagram: true,
    photoCount: 8,
    hasOpeningHours: true,
    ...overrides,
  };
}

function details(overrides: Partial<PlaceDetails> = {}): PlaceDetails {
  return {
    provider: "google_places",
    providerPlaceId: "places/abc",
    displayName: "Deniz Restoran",
    formattedAddress: "Kadıköy",
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
    priceLevel: null,
    reviewSample: null,
    socialProfiles: null,
    detailLevel: "basic",
    fieldMask: DETAILS_MASK_BY_DEPTH.basic,
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

const INPUT = {
  current: { displayName: "Deniz Restoran", metrics: metrics({ hasWebsite: false, websiteQuality: null, rating: 3.9, reviewCount: 12, hasInstagram: false }) },
  competitors: [
    { providerPlaceId: "places/1", displayName: "Balıkçı Ali", distanceM: 120, metrics: metrics({ rating: 4.5, reviewCount: 220, photoCount: 10 }) },
    { providerPlaceId: "places/2", displayName: "Meyhane Bekir", distanceM: 340, metrics: metrics({ hasWebsite: false, websiteQuality: null, rating: 4.1, reviewCount: 80, photoCount: 4 }) },
    { providerPlaceId: "places/3", displayName: "Sahil Lokantası", distanceM: null, metrics: metrics({ rating: 4.7, reviewCount: 310, websiteQuality: "strong", photoCount: 9 }) },
  ],
  categoryKey: "restaurants_cafes",
  radiusM: 1500,
  locale: "tr" as const,
};

describe("buildCompetitorBenchmark", () => {
  const summary = buildCompetitorBenchmark(INPUT);

  it("anonymises competitors while keeping their ids and distances", () => {
    expect(summary.competitors.map((competitor) => competitor.displayName)).toEqual(["Rakip A", "Rakip B", "Rakip C"]);
    expect(summary.competitors.map((competitor) => competitor.providerPlaceId)).toEqual(["places/1", "places/2", "places/3"]);
    expect(summary.competitors[0].distanceM).toBe(120);
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("Balıkçı Ali");
    expect(serialized).not.toContain("Meyhane Bekir");
  });

  it("states metrics with counts and ranges and never ranks anyone", () => {
    const byMetric = new Map(summary.comparisons.map((comparison) => [comparison.metric, comparison.statement]));
    expect(byMetric.get("hasWebsite")).toContain("2");
    expect(byMetric.get("rating")).toContain("3.9");
    expect(byMetric.get("rating")).toContain("4.5");
    expect(byMetric.get("reviewCount")).toContain("310");
    expect(byMetric.get("websiteQuality")).toContain("güçlü");

    for (const comparison of summary.comparisons) {
      expect(comparison.statement).not.toMatch(JUDGEMENT_WORDS);
      expect(comparison.statement.length).toBeGreaterThan(20);
    }
  });

  it("keeps the input metrics and context", () => {
    expect(summary.radiusM).toBe(1500);
    expect(summary.categoryKey).toBe("restaurants_cafes");
    expect(summary.current.hasWebsite).toBe(false);
    expect(Date.parse(summary.generatedAt)).not.toBeNaN();
  });

  it("says nothing about a metric no competitor has data for", () => {
    const blind = buildCompetitorBenchmark({
      ...INPUT,
      competitors: INPUT.competitors.map((competitor) => ({ ...competitor, metrics: metrics({ hasInstagram: null, photoCount: null, websiteQuality: null }) })),
    });
    const metricsCovered = blind.comparisons.map((comparison) => comparison.metric);
    expect(metricsCovered).not.toContain("hasInstagram");
    expect(metricsCovered).not.toContain("photoCount");
    expect(metricsCovered).not.toContain("websiteQuality");
    expect(metricsCovered).toContain("hasWebsite");
  });

  it("produces English statements for the en locale", () => {
    const english = buildCompetitorBenchmark({ ...INPUT, locale: "en" });
    expect(english.competitors[0].displayName).toBe("Competitor A");
    for (const comparison of english.comparisons) {
      expect(comparison.statement).not.toMatch(JUDGEMENT_WORDS);
    }
    expect(english.comparisons.find((comparison) => comparison.metric === "hasWebsite")?.statement).toContain("website link");
  });
});

describe("metricsFromDetails", () => {
  it("reads what the provider actually returned", () => {
    expect(metricsFromDetails(details(), "strong", true)).toEqual({
      hasWebsite: true,
      websiteQuality: "strong",
      rating: 4.6,
      reviewCount: 148,
      hasInstagram: true,
      photoCount: 8,
      hasOpeningHours: true,
    });
  });

  it("leaves fields outside the field mask as unknown", () => {
    const discovery = metricsFromDetails(
      details({ detailLevel: "discovery", fieldMask: DETAILS_MASK_BY_DEPTH.discovery, rating: null, userRatingCount: null, websiteUri: null, openingHours: null, photoCount: null }),
    );
    expect(discovery).toEqual({
      hasWebsite: null,
      websiteQuality: null,
      rating: null,
      reviewCount: null,
      hasInstagram: null,
      photoCount: null,
      hasOpeningHours: null,
    });
  });
});
