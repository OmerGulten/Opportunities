import { describe, expect, it } from "vitest";

import { createFakeFetcher, STRONG_HTML } from "../../../tests/fixtures/html";
import { ProviderUnavailableError } from "@/lib/errors";
import { DETAILS_MASK_BY_DEPTH } from "@/lib/providers/places/field-masks";
import type { PerformanceAuditOptions, PerformanceProvider } from "@/lib/providers/performance/types";
import type { PerformanceAuditSummary } from "@/types/audits";
import type { PlaceDetails } from "@/types/places";
import { SIGNAL_TYPES, type Signal } from "@/types/signals";

import { runBusinessAudit } from "./run-business-audit";

const SITE = "https://denizrestoran.com/";

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
    websiteUri: SITE,
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

function routes() {
  return {
    [SITE]: { body: STRONG_HTML },
    "/robots.txt": { body: "User-agent: *\nAllow: /", contentType: "text/plain" },
    "/sitemap.xml": { body: '<?xml version="1.0"?><urlset></urlset>', contentType: "application/xml" },
  };
}

function index(signals: readonly Signal[]): Map<string, Signal> {
  return new Map(signals.map((signal) => [signal.signalType, signal]));
}

const HEURISTIC_SUMMARY: PerformanceAuditSummary = {
  source: "heuristic",
  isHeuristic: true,
  mobileScore: 44,
  desktopScore: 54,
  lcpMs: null,
  cls: null,
  inpMs: null,
  mobileGrade: "poor",
  measuredAt: new Date().toISOString(),
  notes: ["Heuristic estimate from the HTML only."],
};

function fakePerformanceProvider(options: { onAudit?: (url: string, opts: PerformanceAuditOptions) => void; throws?: unknown } = {}): PerformanceProvider {
  return {
    name: "heuristic",
    isHeuristic: true,
    async audit(url: string, auditOptions: PerformanceAuditOptions = {}) {
      options.onAudit?.(url, auditOptions);
      if (options.throws !== undefined) throw options.throws;
      return HEURISTIC_SUMMARY;
    },
  };
}

describe("runBusinessAudit at basic depth", () => {
  it("merges every area into one signal set with no duplicates", async () => {
    const bundle = await runBusinessAudit({
      details: details(),
      depth: "basic",
      locale: "tr",
      fetcher: createFakeFetcher(routes()),
      features: { instagramDiscovery: true, performance: true },
    });

    expect(bundle.outcomes.map((outcome) => outcome.auditType)).toEqual(["google_business", "website", "performance", "instagram"]);
    expect(bundle.websiteStatus).toBe("found");
    expect(bundle.instagramStatus).toBe("found");

    const types = bundle.signals.map((signal) => signal.signalType);
    expect(new Set(types).size).toBe(types.length);
    for (const signalType of Object.values(SIGNAL_TYPES)) {
      expect(types, signalType).toContain(signalType);
    }

    const signals = index(bundle.signals);
    expect(signals.get("branding.has_logo_signal")).toMatchObject({ value: true, status: "found" });
    expect(signals.get("branding.consistency_score")).toMatchObject({ evidenceType: "heuristic" });
    expect(signals.get("instagram.status")).toMatchObject({ value: "found" });
    expect(signals.get("performance.mobile_score")?.status).toBe("not_checked");
    expect(bundle.findings.length).toBeGreaterThan(0);
    expect(bundle.findings.every((finding) => finding.title.length > 0 && !finding.title.includes("."))).toBe(true);
  });

  it("keeps branding findings attached to the website outcome so they can be persisted", async () => {
    const bundle = await runBusinessAudit({
      details: details({ websiteUri: null }),
      depth: "basic",
      locale: "tr",
      fetcher: createFakeFetcher({}),
      features: { instagramDiscovery: true, performance: false },
    });

    const website = bundle.outcomes.find((outcome) => outcome.auditType === "website");
    expect(website?.signals.some((signal) => signal.signalType === "branding.has_logo_signal")).toBe(true);
    // Invariant the mappers rely on: every bundle finding belongs to an outcome.
    expect(bundle.findings).toEqual(bundle.outcomes.flatMap((outcome) => outcome.findings));
    expect(bundle.websiteStatus).toBe("not_found");
    // No website means the website could not link to Instagram either.
    expect(bundle.instagramStatus).toBe("not_found");
    expect(index(bundle.signals).get("branding.has_logo_signal")).toMatchObject({ status: "not_checked", evidenceType: "unavailable" });
  });
});

describe("runBusinessAudit at discovery depth", () => {
  it("never opens the website and reports unchecked fields honestly", async () => {
    let calls = 0;
    const bundle = await runBusinessAudit({
      details: details({ detailLevel: "discovery", fieldMask: DETAILS_MASK_BY_DEPTH.discovery, websiteUri: null, rating: null, userRatingCount: null, openingHours: null, photoCount: null, phoneNational: null, phoneInternational: null }),
      depth: "discovery",
      locale: "tr",
      fetcher: createFakeFetcher({}, () => {
        calls += 1;
      }),
      features: { instagramDiscovery: true, performance: true },
    });

    expect(calls).toBe(0);
    expect(bundle.websiteStatus).toBe("not_checked");
    expect(bundle.instagramStatus).toBe("not_checked");
    const signals = index(bundle.signals);
    expect(signals.get("website.status")).toMatchObject({ status: "not_checked", evidenceType: "unavailable" });
    expect(signals.get("google.has_website")?.status).toBe("not_checked");
    expect(signals.get("instagram.status")?.status).toBe("not_checked");
  });

  it("uses the provider website link when the field was inside the mask", async () => {
    const bundle = await runBusinessAudit({
      details: details({ detailLevel: "discovery" }),
      depth: "discovery",
      locale: "tr",
      fetcher: createFakeFetcher({}),
      features: { instagramDiscovery: false, performance: false },
    });

    expect(bundle.websiteStatus).toBe("found");
    expect(index(bundle.signals).get("website.status")).toMatchObject({ value: "found", status: "found", confidence: "high", source: "provider" });
    expect(index(bundle.signals).get("website.has_cta")?.status).toBe("not_checked");
  });
});

describe("runBusinessAudit at deep depth", () => {
  it("passes the already fetched HTML to the performance provider", async () => {
    const seen: Array<{ url: string; opts: PerformanceAuditOptions }> = [];
    const bundle = await runBusinessAudit({
      details: details({ detailLevel: "deep", fieldMask: DETAILS_MASK_BY_DEPTH.deep }),
      depth: "deep",
      locale: "tr",
      fetcher: createFakeFetcher(routes()),
      performanceProvider: fakePerformanceProvider({ onAudit: (url, opts) => seen.push({ url, opts }) }),
      features: { instagramDiscovery: true, performance: true },
    });

    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe(SITE);
    expect(seen[0].opts.html).toBe(STRONG_HTML);
    expect(seen[0].opts.responseTimeMs).toBe(120);

    const signals = index(bundle.signals);
    expect(signals.get("performance.mobile_score")).toMatchObject({ value: 44, evidenceType: "heuristic", confidence: "low" });
    expect(signals.get("performance.mobile_grade")).toMatchObject({ value: "poor" });
    expect(signals.get("performance.lcp_ms")).toMatchObject({ status: "unavailable" });
    const finding = bundle.findings.find((entry) => entry.key === "performance_poor_mobile");
    expect(finding?.evidenceType).toBe("heuristic");
    expect(finding?.explanation).toContain("Lighthouse");
  });

  it("skips performance when there is no reachable website", async () => {
    const bundle = await runBusinessAudit({
      details: details({ websiteUri: null }),
      depth: "deep",
      locale: "tr",
      fetcher: createFakeFetcher({}),
      performanceProvider: fakePerformanceProvider(),
      features: { instagramDiscovery: true, performance: true },
    });

    const performance = bundle.outcomes.find((outcome) => outcome.auditType === "performance");
    expect(performance?.status).toBe("skipped");
    expect(index(bundle.signals).get("performance.mobile_score")).toMatchObject({ status: "not_checked", evidenceType: "unavailable" });
  });
});

describe("runBusinessAudit failure isolation", () => {
  it("keeps the other audits when the performance provider throws", async () => {
    const bundle = await runBusinessAudit({
      details: details({ detailLevel: "deep", fieldMask: DETAILS_MASK_BY_DEPTH.deep }),
      depth: "deep",
      locale: "tr",
      fetcher: createFakeFetcher(routes()),
      performanceProvider: fakePerformanceProvider({ throws: new ProviderUnavailableError("pagespeed") }),
      features: { instagramDiscovery: true, performance: true },
    });

    const performance = bundle.outcomes.find((outcome) => outcome.auditType === "performance");
    expect(performance?.status).toBe("failed");
    expect(performance?.errorCode).toBe("provider_unavailable");
    expect(performance?.observation).toBe("error");

    const signals = index(bundle.signals);
    expect(signals.get("performance.mobile_score")).toMatchObject({ status: "error", evidenceType: "unavailable", value: null });
    // Everything else still produced its observations.
    expect(bundle.websiteStatus).toBe("found");
    expect(signals.get("google.rating")).toMatchObject({ value: 4.6 });
    expect(signals.get("website.has_cta")).toMatchObject({ value: true });
  });

  it("keeps the other audits when the Google audit throws", async () => {
    const exploding = new Proxy(details(), {
      get(target, property, receiver) {
        if (property === "rating") throw new Error("provider payload is corrupt");
        return Reflect.get(target, property, receiver) as unknown;
      },
    }) as PlaceDetails;

    const bundle = await runBusinessAudit({
      details: exploding,
      depth: "basic",
      locale: "tr",
      fetcher: createFakeFetcher(routes()),
      features: { instagramDiscovery: true, performance: false },
    });

    const google = bundle.outcomes.find((outcome) => outcome.auditType === "google_business");
    expect(google?.status).toBe("failed");
    expect(google?.errorCode).toBe("internal_error");
    expect(index(bundle.signals).get("google.rating")).toMatchObject({ status: "error", value: null });
    expect(bundle.websiteStatus).toBe("found");
    expect(bundle.instagramStatus).toBe("found");
  });
});
