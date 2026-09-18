import { describe, expect, it } from "vitest";

import type { Signal } from "@/types/signals";

import { discoverInstagram, handleMatchesName, parseInstagramHandle } from "./discover";

function index(signals: readonly Signal[]): Map<string, Signal> {
  return new Map(signals.map((signal) => [signal.signalType, signal]));
}

const BASE = { businessName: "Deniz Restoran Kadıköy", locale: "tr" as const };

describe("parseInstagramHandle", () => {
  it("reads a profile handle", () => {
    expect(parseInstagramHandle("https://www.instagram.com/denizrestoran/")).toBe("denizrestoran");
    expect(parseInstagramHandle("https://instagram.com/deniz.restoran_kadikoy")).toBe("deniz.restoran_kadikoy");
  });

  it("returns null for post, reel and explore URLs", () => {
    expect(parseInstagramHandle("https://www.instagram.com/p/Cabc123/")).toBeNull();
    expect(parseInstagramHandle("https://www.instagram.com/reel/Cabc123/")).toBeNull();
    expect(parseInstagramHandle("https://www.instagram.com/explore/tags/balik/")).toBeNull();
    expect(parseInstagramHandle("not a url")).toBeNull();
  });
});

describe("handleMatchesName", () => {
  it("recognises handles built from the business name", () => {
    expect(handleMatchesName("denizrestoran", "Deniz Restoran Kadıköy")).toBe(true);
    expect(handleMatchesName("deniz_restoran", "Deniz Restoran Kadıköy")).toBe(true);
    expect(handleMatchesName("denizrestoran.kadikoy", "Deniz Restoran Kadıköy")).toBe(true);
    // One shared word out of three is not enough to claim a match.
    expect(handleMatchesName("kadikoy.balikcisi", "Deniz Restoran Kadıköy")).toBe(false);
    expect(handleMatchesName("yemekgunlugu", "Deniz Restoran Kadıköy")).toBe(false);
  });
});

describe("discoverInstagram", () => {
  it("trusts a provider profile with high confidence", () => {
    const outcome = discoverInstagram({
      ...BASE,
      websiteSocialLinks: null,
      providerProfiles: [{ platform: "instagram", url: "https://www.instagram.com/denizrestoran/" }],
    });

    expect(outcome.summary.status).toBe("found");
    expect(outcome.summary.discoveredVia).toBe("provider");
    expect(outcome.summary.handle).toBe("denizrestoran");
    expect(index(outcome.signals).get("instagram.status")).toMatchObject({ value: "found", confidence: "high", source: "provider" });
  });

  it("uses a website link with medium confidence, or high when the handle matches the name", () => {
    const matching = discoverInstagram({
      ...BASE,
      websiteSocialLinks: [{ platform: "instagram", url: "https://www.instagram.com/denizrestoran/" }],
      providerProfiles: null,
    });
    expect(matching.summary.discoveredVia).toBe("website");
    expect(index(matching.signals).get("instagram.status")).toMatchObject({ value: "found", confidence: "high" });

    const unrelated = discoverInstagram({
      ...BASE,
      websiteSocialLinks: [{ platform: "instagram", url: "https://www.instagram.com/yemekgunlugu/" }],
      providerProfiles: null,
    });
    expect(index(unrelated.signals).get("instagram.status")).toMatchObject({ value: "found", confidence: "medium" });
    expect(unrelated.summary.handle).toBe("yemekgunlugu");
  });

  it("falls back to low confidence when only a post link is available", () => {
    const outcome = discoverInstagram({
      ...BASE,
      websiteSocialLinks: [{ platform: "instagram", url: "https://www.instagram.com/p/Cabc123/" }],
      providerProfiles: null,
    });
    expect(outcome.summary.status).toBe("found");
    expect(outcome.summary.handle).toBeNull();
    expect(index(outcome.signals).get("instagram.status")?.confidence).toBe("low");
  });

  it("reports ambiguity when the website links several handles", () => {
    const outcome = discoverInstagram({
      ...BASE,
      websiteSocialLinks: [
        { platform: "instagram", url: "https://www.instagram.com/denizrestoran/" },
        { platform: "instagram", url: "https://www.instagram.com/denizcatering/" },
      ],
      providerProfiles: null,
    });

    expect(outcome.summary.status).toBe("ambiguous");
    expect(outcome.observation).toBe("ambiguous");
    expect(outcome.findings.map((finding) => finding.key)).toContain("instagram_ambiguous");
    expect(index(outcome.signals).get("instagram.status")).toMatchObject({ value: "ambiguous", confidence: "low" });
  });

  it("stays not_checked when the website was never audited", () => {
    const outcome = discoverInstagram({ ...BASE, websiteSocialLinks: null, providerProfiles: null });

    expect(outcome.summary.status).toBe("not_checked");
    const status = index(outcome.signals).get("instagram.status");
    expect(status).toMatchObject({ status: "not_checked", evidenceType: "unavailable" });
    expect(outcome.findings.map((finding) => finding.key)).toContain("instagram_not_checked");
    expect(outcome.findings.map((finding) => finding.key)).not.toContain("instagram_not_found");
  });

  it("reports not_found with medium confidence when other socials are present", () => {
    const outcome = discoverInstagram({
      ...BASE,
      websiteSocialLinks: [{ platform: "facebook", url: "https://www.facebook.com/denizrestoran" }],
      providerProfiles: null,
    });

    expect(outcome.summary.status).toBe("not_found");
    expect(index(outcome.signals).get("instagram.status")).toMatchObject({ value: "not_found", status: "not_found", confidence: "medium" });
    expect(outcome.findings.find((finding) => finding.key === "instagram_not_found")?.severity).toBe("medium");
  });

  it("reports not_found with low confidence when the website has no social links at all", () => {
    const outcome = discoverInstagram({ ...BASE, websiteSocialLinks: [], providerProfiles: null });

    expect(outcome.summary.status).toBe("not_found");
    expect(index(outcome.signals).get("instagram.status")?.confidence).toBe("low");
    expect(outcome.findings.find((finding) => finding.key === "instagram_not_found")?.severity).toBe("low");
  });

  it("always leaves profile content unavailable and says so", () => {
    const outcome = discoverInstagram({
      ...BASE,
      websiteSocialLinks: [{ platform: "instagram", url: "https://www.instagram.com/denizrestoran/" }],
      providerProfiles: null,
    });

    const signals = index(outcome.signals);
    for (const type of [
      "instagram.days_since_last_post",
      "instagram.is_active",
      "instagram.has_website_link",
      "instagram.bio_complete",
      "instagram.follower_count",
    ]) {
      expect(signals.get(type)).toMatchObject({ status: "unavailable", evidenceType: "unavailable", value: null });
      expect(signals.get(type)?.explanation.length).toBeGreaterThan(10);
    }
    expect(outcome.summary.isActive).toBeNull();
    expect(outcome.findings.map((finding) => finding.key)).toContain("instagram_activity_unavailable");
    expect(outcome.summary.notes.length).toBeGreaterThan(0);
  });
});
