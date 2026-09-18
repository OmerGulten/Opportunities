import { beforeAll, describe, expect, it } from "vitest";

import { runBusinessAudit } from "@/lib/audits/run-business-audit";
import { DEMO_BUSINESSES } from "@/lib/demo/businesses";
import { createDemoFetcher } from "@/lib/demo/websites";
import { createHeuristicPerformanceProvider } from "@/lib/providers/performance/heuristic";
import { createDemoPlaceProvider } from "@/lib/providers/places/demo";
import { loadDefaultRules, scoreBusiness } from "@/lib/scoring";
import { passesPreAuditFilters } from "@/lib/workflows/scan/filters";
import type { SafeFetcher } from "@/lib/security/safe-fetch";
import type { OpportunityResult } from "@/types/scoring";
import type { PlaceDetails } from "@/types/places";

/**
 * End-to-end check of the product's core claim, with no database involved:
 * a real demo business goes through the provider, the audit engine and the
 * scoring engine, and the resulting service scores are the ones a user would
 * be shown.
 *
 * This is the test that would catch the two failures that matter most: scores
 * drifting away from the evidence, and unchecked things being reported as
 * absent.
 */

const provider = createDemoPlaceProvider({ latencyMs: 0 });
const fetcher = createDemoFetcher() as unknown as SafeFetcher;
const performance = createHeuristicPerformanceProvider();
const { services, rules } = loadDefaultRules();

async function auditAndScore(providerPlaceId: string, depth: "discovery" | "basic" | "deep" = "basic"): Promise<{ details: PlaceDetails; result: OpportunityResult; signals: Awaited<ReturnType<typeof runBusinessAudit>>["signals"] }> {
  const details = await provider.getBusinessDetails(providerPlaceId, { depth });
  const bundle = await runBusinessAudit({
    details,
    depth,
    locale: "tr",
    fetcher,
    performanceProvider: performance,
    features: { instagramDiscovery: true, performance: true },
  });
  const result = scoreBusiness(bundle.signals, rules, services, {
    locale: "tr",
    auditDepth: depth,
    serviceIds: services.map((service) => service.id),
  });
  return { details, result, signals: bundle.signals };
}

function scoreOf(result: OpportunityResult, serviceKey: string): number {
  return result.serviceScores.find((score) => score.serviceKey === serviceKey)?.score ?? -1;
}

describe("demo fixtures", () => {
  it("provides a varied population to score against", () => {
    expect(DEMO_BUSINESSES.length).toBeGreaterThanOrEqual(40);
    expect(DEMO_BUSINESSES.some((business) => business.websiteUri === null)).toBe(true);
    expect(DEMO_BUSINESSES.some((business) => business.websiteUri !== null)).toBe(true);
  });
});

describe("a business with no website", () => {
  const withoutWebsite = DEMO_BUSINESSES.find((business) => business.websiteUri === null)!;
  let outcome: Awaited<ReturnType<typeof auditAndScore>>;

  beforeAll(async () => {
    outcome = await auditAndScore(withoutWebsite.providerPlaceId, "basic");
  });

  it("reports website development as a strong opportunity", () => {
    expect(scoreOf(outcome.result, "website_development")).toBeGreaterThanOrEqual(55);
  });

  it("makes website development the primary opportunity", () => {
    expect(outcome.result.primaryServiceKey).toBe("website_development");
  });

  it("flags the missing website as a digital gap", () => {
    expect(outcome.result.digitalGaps).toContain("no_website");
  });

  it("derives the missing booking and contact flows rather than claiming they were checked", () => {
    const booking = outcome.signals.find((signal) => signal.signalType === "website.has_booking");
    expect(booking?.value).toBe(false);
    expect(booking?.evidenceType).toBe("derived");
  });

  it("leaves page-level checks unavailable instead of reporting them as absent", () => {
    // There is no page to inspect, so a missing meta description is unknown,
    // not observed. Reporting it as a finding would be an invented fact.
    const metaDescription = outcome.signals.find((signal) => signal.signalType === "website.has_meta_description");
    expect(metaDescription?.status).toBe("not_checked");
    expect(metaDescription?.evidenceType).toBe("unavailable");
  });

  it("explains every point it awarded", () => {
    const website = outcome.result.serviceScores.find((score) => score.serviceKey === "website_development")!;
    expect(website.reasons.length).toBeGreaterThan(0);
    for (const reason of website.reasons) {
      expect(reason.points).toBeGreaterThan(0);
      expect(reason.explanation.trim()).not.toBe("");
      expect(reason.ruleKey.trim()).not.toBe("");
    }
    // The score is exactly the points that were justified, normalised.
    const awarded = website.reasons.reduce((sum, reason) => sum + reason.points, 0);
    expect(website.rawPoints).toBe(awarded);
  });
});

describe("a business with a website", () => {
  const withWebsite = DEMO_BUSINESSES.find((business) => business.websiteUri !== null)!;
  let outcome: Awaited<ReturnType<typeof auditAndScore>>;

  beforeAll(async () => {
    outcome = await auditAndScore(withWebsite.providerPlaceId, "basic");
  });

  it("does not claim the website is missing", () => {
    expect(outcome.result.digitalGaps).not.toContain("no_website");
    const status = outcome.signals.find((signal) => signal.signalType === "website.status");
    expect(status?.value).not.toBe("not_found");
  });

  it("scores every service the workspace sells", () => {
    expect(outcome.result.serviceScores).toHaveLength(services.length);
    for (const score of outcome.result.serviceScores) {
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
    }
  });

  it("keeps the overall score within the range of its service scores", () => {
    const best = Math.max(...outcome.result.serviceScores.map((score) => score.score));
    expect(outcome.result.overallScore).toBeLessThanOrEqual(best);
    expect(outcome.result.overallScore).toBeGreaterThanOrEqual(0);
  });
});

describe("audit depth", () => {
  const business = DEMO_BUSINESSES.find((entry) => entry.websiteUri !== null)!;

  it("does not invent page-level findings at discovery depth", async () => {
    const { signals } = await auditAndScore(business.providerPlaceId, "discovery");
    const pageSignals = signals.filter((signal) => signal.signalType.startsWith("website.has_"));
    expect(pageSignals.length).toBeGreaterThan(0);
    for (const signal of pageSignals) {
      // Nothing was fetched, so nothing may be reported as observed.
      expect(["not_checked", "unavailable"]).toContain(signal.status);
    }
  });

  it("only produces performance signals once a deep audit runs", async () => {
    const basic = await auditAndScore(business.providerPlaceId, "basic");
    const deep = await auditAndScore(business.providerPlaceId, "deep");

    const basicScore = basic.signals.find((signal) => signal.signalType === "performance.mobile_score");
    const deepScore = deep.signals.find((signal) => signal.signalType === "performance.mobile_score");

    if (basicScore) expect(["not_checked", "unavailable"]).toContain(basicScore.status);
    expect(deepScore?.status).toBe("found");
    // A heuristic estimate must never be presented as a measured Lighthouse score.
    expect(deepScore?.evidenceType).toBe("heuristic");
  });
});

describe("scan filters against real provider details", () => {
  it("selects only businesses without a website when asked", async () => {
    const sample = DEMO_BUSINESSES.slice(0, 12);
    const details = await Promise.all(sample.map((business) => provider.getBusinessDetails(business.providerPlaceId, { depth: "basic" })));

    const matched = details.filter((entry) => passesPreAuditFilters(entry, { website: "none" }, "basic"));
    expect(matched.length).toBeGreaterThan(0);
    for (const entry of matched) expect(entry.websiteUri).toBeNull();
  });

  it("selects only businesses missing opening hours when asked", async () => {
    const sample = DEMO_BUSINESSES.slice(0, 20);
    const details = await Promise.all(sample.map((business) => provider.getBusinessDetails(business.providerPlaceId, { depth: "basic" })));

    const matched = details.filter((entry) => passesPreAuditFilters(entry, { google: ["missing_hours"] }, "basic"));
    for (const entry of matched) expect(entry.openingHours).toBeNull();
  });
});
