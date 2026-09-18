import { describe, expect, it } from "vitest";

import { DEMO_BUSINESSES } from "@/lib/demo/businesses";
import { createDemoFetcher } from "@/lib/demo/websites";
import type { SafeFetcher } from "@/lib/security/safe-fetch";
import type { WebsiteAuditSummary } from "@/types/audits";

import { auditWebsite } from "./audit";

/**
 * Runs the real audit against the demo website fixtures. This is the closest
 * thing to a live page the test suite has: it proves the parser copes with every
 * demo profile and that the demo fetcher can stand in for `safeFetchUrl`.
 */

const fetcher: SafeFetcher = createDemoFetcher();

async function auditDemo(index: number): Promise<WebsiteAuditSummary> {
  const business = DEMO_BUSINESSES[index];
  const { outcome } = await auditWebsite({
    url: business.websiteUri,
    businessName: business.displayName,
    locale: "tr",
    depth: "basic",
    fetcher,
  });
  return outcome.summary;
}

describe("auditWebsite against the demo fixtures", () => {
  it("audits every demo business without throwing and classifies each result", async () => {
    const results = await Promise.all(DEMO_BUSINESSES.map((_business, index) => auditDemo(index)));

    expect(results).toHaveLength(DEMO_BUSINESSES.length);
    for (const [index, summary] of results.entries()) {
      const business = DEMO_BUSINESSES[index];
      if (business.websiteUri === null) {
        expect(summary.websiteStatus).toBe("not_found");
        expect(summary.quality).toBeNull();
        continue;
      }
      expect(["found", "unreachable", "invalid"]).toContain(summary.websiteStatus);
      if (summary.websiteStatus === "found") {
        expect(summary.quality).not.toBeNull();
        expect(summary.qualityScore ?? -1).toBeGreaterThanOrEqual(0);
        expect(summary.technical?.finalUrl).toContain(new URL(business.websiteUri).hostname);
      } else {
        expect(summary.quality).toBeNull();
      }
    }
  });

  it("separates the strong profiles from the weak ones", async () => {
    const scores = new Map<string, number>();
    for (const [index, business] of DEMO_BUSINESSES.entries()) {
      if (business.websiteProfile === null) continue;
      if (scores.has(business.websiteProfile)) continue;
      const summary = await auditDemo(index);
      if (summary.qualityScore !== null) scores.set(business.websiteProfile, summary.qualityScore);
    }

    const strong = scores.get("strong");
    const weak = scores.get("weak_legacy");
    expect(strong).toBeDefined();
    expect(weak).toBeDefined();
    expect(strong ?? 0).toBeGreaterThan(weak ?? 100);
    expect(strong ?? 0).toBeGreaterThan(70);
  });
});
