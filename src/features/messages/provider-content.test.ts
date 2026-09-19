import { describe, expect, it } from "vitest";

import type { VerifiedBusinessFacts } from "@/types/ai";

import { PROVIDER_DERIVED_FACT_KEYS, redactProviderContent } from "./provider-content";

const facts: VerifiedBusinessFacts = {
  businessName: "Cafe Benazio",
  categoryLabel: "Restoran & Kafe",
  district: "Kadikoy",
  city: "Istanbul",
  rating: 4.4,
  reviewCount: 650,
  websiteStatus: "not_found",
  websiteUrl: null,
  instagramStatus: "not_found",
  googleGaps: ["website link missing"],
  topFindings: [{ key: "no_website", title: "No website found", confidence: "high" }],
  serviceScores: [{ serviceKey: "web", serviceLabel: "Web Development", score: 80 }],
};

describe("redactProviderContent", () => {
  it("removes every Places-derived field", () => {
    const redacted = redactProviderContent(facts);
    expect(redacted.businessName).toBe("");
    expect(redacted.district).toBeNull();
    expect(redacted.city).toBeNull();
    expect(redacted.rating).toBeNull();
    expect(redacted.reviewCount).toBeNull();
    expect(redacted.googleGaps).toEqual([]);
  });

  it("leaves nothing identifying in what a third-party model would receive", () => {
    // The guarantee that matters: no Google-derived string survives anywhere in
    // the serialised payload, not merely in the fields we remembered to null.
    const serialised = JSON.stringify(redactProviderContent(facts));
    for (const leak of ["Cafe Benazio", "Kadikoy", "Istanbul", "4.4", "650", "website link missing"]) {
      expect(serialised).not.toContain(leak);
    }
  });

  it("keeps the facts this application produced itself", () => {
    const redacted = redactProviderContent(facts);
    expect(redacted.websiteStatus).toBe("not_found");
    expect(redacted.topFindings).toHaveLength(1);
    expect(redacted.serviceScores[0]?.score).toBe(80);
    expect(redacted.categoryLabel).toBe("Restoran & Kafe");
  });

  it("names the fields it strips, so the report and the code cannot drift", () => {
    const redacted = redactProviderContent(facts) as unknown as Record<string, unknown>;
    const original = facts as unknown as Record<string, unknown>;
    const changed = Object.keys(original).filter((k) => JSON.stringify(original[k]) !== JSON.stringify(redacted[k]));
    expect(changed.sort()).toEqual([...PROVIDER_DERIVED_FACT_KEYS].sort());
  });
});
