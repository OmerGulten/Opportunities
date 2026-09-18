import { describe, expect, it } from "vitest";

import type { OpportunityResult, ScoringOptions, ServiceDefinition, ServiceRule, ServiceScoreResult } from "@/types/scoring";
import { SIGNAL_TYPES, makeSignal, makeUnavailableSignal, type Signal } from "@/types/signals";

import { kadikoyRestaurantNoWebsiteSignals, strongWebsiteCafeSignals, weakWebsiteSeoGapsBasicSignals, weakWebsiteSeoGapsSignals } from "../../../tests/fixtures/signals";
import { loadDefaultRules } from "./defaults";
import { DEFAULT_SECONDARY_THRESHOLD, scoreBusiness, serviceConfidence } from "./engine";

const { services, rules } = loadDefaultRules();
const allServiceIds = services.map((service) => service.id);
const NOW = new Date("2026-09-18T12:00:00.000Z");

function options(overrides: Partial<ScoringOptions> = {}): ScoringOptions {
  return { locale: "tr", auditDepth: "basic", serviceIds: allServiceIds, ...overrides };
}

function service(result: OpportunityResult, key: string): ServiceScoreResult {
  const found = result.serviceScores.find((score) => score.serviceKey === key);
  if (!found) throw new Error(`service ${key} missing from result`);
  return found;
}

function unavailableReason(score: ServiceScoreResult, ruleKey: string): string | undefined {
  return score.unavailableRules.find((rule) => rule.ruleKey === ruleKey)?.reason;
}

function matchedKeys(score: ServiceScoreResult): string[] {
  return score.reasons.map((reason) => reason.ruleKey);
}

function mkService(overrides: Partial<ServiceDefinition> & { id: string; key: string }): ServiceDefinition {
  return { nameTr: overrides.key, nameEn: overrides.key, scoreNormalizer: null, sortOrder: 10, active: true, ...overrides };
}

function mkRule(overrides: Partial<ServiceRule> & { id: string; serviceId: string; key: string; signalType: string }): ServiceRule {
  return {
    nameTr: `${overrides.key} tr`,
    nameEn: `${overrides.key} en`,
    explanationTr: `${overrides.key} açıklama`,
    explanationEn: `${overrides.key} explanation`,
    operator: "is_false",
    value: null,
    points: 10,
    minConfidence: "low",
    requiresDepth: "discovery",
    active: true,
    sortOrder: 10,
    version: 1,
    ...overrides,
  };
}

function signal(signalType: string, value: Signal["value"], overrides: Partial<Signal> = {}): Signal {
  return makeSignal(signalType, value, { source: "google_audit", confidence: "high", explanation: "test", detectedAt: "2026-09-18T09:00:00.000Z", ...overrides });
}

describe("scoreBusiness with default rules", () => {
  describe("fixture (a): Kadıköy restaurant without a website, basic depth", () => {
    const result = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, options(), NOW);

    it("website development is the primary opportunity with a high score", () => {
      const web = service(result, "website_development");
      expect(web.score).toBeGreaterThanOrEqual(75);
      expect(web.score).toBe(80);
      expect(result.primaryServiceKey).toBe("website_development");
      expect(result.primaryServiceId).toBe(web.serviceId);
      expect(matchedKeys(web)).toEqual(["no_website", "no_cta", "no_contact_info", "no_booking"]);
      expect(web.rawPoints).toBe(80);
      expect(web.maxPoints).toBe(100);
      expect(web.evaluablePoints).toBe(80);
      expect(web.confidence).toBe("high");
      // Rules whose signals the audit did not produce are reported, not silently skipped.
      expect(unavailableReason(web, "weak_website")).toBe("signal_missing");
      expect(unavailableReason(web, "no_https")).toBe("signal_missing");
    });

    it("google business scores from the profile gaps", () => {
      const google = service(result, "google_business");
      expect(google.score).toBeGreaterThanOrEqual(55);
      expect(google.score).toBe(60);
      expect(matchedKeys(google)).toEqual(["missing_hours", "few_photos", "missing_website", "incomplete_profile"]);
      expect(google.evaluablePoints).toBe(100);
      expect(google.confidence).toBe("high");
    });

    it("the unavailable review-response signal does not count", () => {
      const reviews = service(result, "review_management");
      expect(unavailableReason(reviews, "low_response_rate")).toBe("unavailable");
      expect(unavailableReason(reviews, "recent_unanswered")).toBe("signal_missing");
      expect(matchedKeys(reviews)).toEqual(["many_reviews"]);
      expect(reviews.rawPoints).toBe(10);
      expect(reviews.evaluablePoints).toBe(70);
    });

    it("not_checked signals never contribute", () => {
      const social = service(result, "social_media");
      expect(unavailableReason(social, "no_instagram")).toBe("not_checked");
      expect(unavailableReason(social, "ambiguous_instagram")).toBe("not_checked");
      expect(matchedKeys(social)).toEqual(["few_photos"]);
      expect(social.score).toBe(10);
    });

    it("ranks services, picks secondaries above the default threshold and combines the overall score", () => {
      expect(result.serviceScores.map((score) => score.serviceKey)).toEqual(["website_development", "google_business", "seo", "branding", "social_media", "review_management"]);
      expect(result.secondaryServiceKeys).toEqual(["google_business"]);
      expect(result.secondaryServiceIds).toEqual([service(result, "google_business").serviceId]);
      // round(0.7 * 80 + 0.3 * mean(80, 60, 30))
      expect(result.overallScore).toBe(73);
      expect(result.confidence).toBe("high");
      expect(result.rulesVersion).toBe(1);
      expect(result.calculatedAt).toBe(NOW.toISOString());
    });

    it("includes the digital gaps", () => {
      expect(result.digitalGaps).toEqual(expect.arrayContaining(["no_website", "missing_hours", "few_photos", "google_incomplete"]));
      expect(result.digitalGaps).not.toContain("no_instagram");
    });

    it("localizes reasons in Turkish by default and in English on request", () => {
      const tr = service(result, "website_development").reasons[0];
      expect(tr.name).toBe("Web sitesi bulunamadı");
      expect(tr.explanation).toBe("İşletme profilinde web sitesi bağlantısı bulunamadı.");
      expect(tr.signalValue).toBe("not_found");
      expect(tr.evidenceType).toBe("observed");
      expect(tr.confidence).toBe("high");

      const en = service(scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, options({ locale: "en" }), NOW), "website_development").reasons[0];
      expect(en.name).toBe("No website found");
      expect(en.explanation).toBe("No website URL was found on the business profile.");
    });

    it("lowers confidence and score when the audit depth gates most rules", () => {
      const discovery = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, options({ auditDepth: "discovery" }), NOW);
      const web = service(discovery, "website_development");
      expect(web.score).toBe(55);
      expect(web.evaluablePoints).toBe(55);
      expect(web.confidence).toBe("medium");
      expect(unavailableReason(web, "no_cta")).toBe("depth_not_reached");

      const seo = service(discovery, "seo");
      expect(seo.score).toBe(30);
      expect(seo.confidence).toBe("low");
    });

    it("applies a custom secondary threshold", () => {
      const loose = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, options({ secondaryThreshold: 30 }), NOW);
      expect(loose.secondaryServiceKeys).toEqual(["google_business", "seo"]);
      const strict = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, options({ secondaryThreshold: 100 }), NOW);
      expect(strict.secondaryServiceKeys).toEqual([]);
      expect(DEFAULT_SECONDARY_THRESHOLD).toBe(50);
    });
  });

  describe("fixture (b): strong café, deep depth", () => {
    const result = scoreBusiness(strongWebsiteCafeSignals, rules, services, options({ auditDepth: "deep" }), NOW);

    it("scores every service below 30", () => {
      for (const score of result.serviceScores) expect(score.score).toBeLessThan(30);
      expect(result.overallScore).toBeLessThan(30);
      expect(result.secondaryServiceKeys).toEqual([]);
      expect(result.digitalGaps).toEqual([]);
    });

    it("still reports which rules were evaluated", () => {
      const web = service(result, "website_development");
      expect(web.evaluablePoints).toBe(140);
      expect(web.unavailableRules).toEqual([]);
      expect(web.score).toBe(0);
    });
  });

  describe("fixture (c): weak website with SEO gaps", () => {
    it("SEO is the primary opportunity at deep depth and the slow_mobile gap is present", () => {
      const deep = scoreBusiness(weakWebsiteSeoGapsSignals, rules, services, options({ auditDepth: "deep" }), NOW);
      const seo = service(deep, "seo");
      expect(deep.primaryServiceKey).toBe("seo");
      expect(seo.score).toBeGreaterThanOrEqual(70);
      expect(seo.score).toBe(80);
      expect(matchedKeys(seo)).toContain("poor_mobile_performance");
      expect(seo.confidence).toBe("high");
      expect(deep.digitalGaps).toContain("slow_mobile");
      expect(deep.digitalGaps).toContain("weak_website");
      expect(service(deep, "website_development").score).toBe(45);
    });

    it("deep rules are unavailable at basic depth and the slow_mobile gap is absent", () => {
      const basic = scoreBusiness(weakWebsiteSeoGapsBasicSignals, rules, services, options({ auditDepth: "basic" }), NOW);
      const seo = service(basic, "seo");
      expect(unavailableReason(seo, "poor_mobile_performance")).toBe("depth_not_reached");
      expect(unavailableReason(seo, "mid_mobile_performance")).toBe("depth_not_reached");
      expect(seo.score).toBe(60);
      expect(basic.digitalGaps).not.toContain("slow_mobile");
    });

    it("depth gating takes precedence even when the deep signal happens to exist", () => {
      const basicWithDeepSignals = scoreBusiness(weakWebsiteSeoGapsSignals, rules, services, options({ auditDepth: "basic" }), NOW);
      expect(unavailableReason(service(basicWithDeepSignals, "seo"), "poor_mobile_performance")).toBe("depth_not_reached");
    });
  });

  it("only scores active services that the workspace sells", () => {
    const seoId = services.find((s) => s.key === "seo")?.id ?? "";
    const result = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, options({ serviceIds: [seoId, "unknown-service"] }), NOW);
    expect(result.serviceScores.map((score) => score.serviceKey)).toEqual(["seo"]);
    expect(result.primaryServiceKey).toBe("seo");

    const inactive = services.map((s) => (s.key === "seo" ? { ...s, active: false } : s));
    const withoutSeo = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, inactive, options(), NOW);
    expect(withoutSeo.serviceScores.map((score) => score.serviceKey)).not.toContain("seo");
  });
});

describe("scoreBusiness with synthetic rules", () => {
  const svc = mkService({ id: "svc-1", key: "svc_one" });
  const base = options({ serviceIds: ["svc-1"], auditDepth: "deep" });

  it("uses the sum of active rule points when no normalizer is set", () => {
    const testRules = [
      mkRule({ id: "r1", serviceId: "svc-1", key: "a", signalType: "x.a", points: 30 }),
      mkRule({ id: "r2", serviceId: "svc-1", key: "b", signalType: "x.b", points: 10, requiresDepth: "deep" }),
      mkRule({ id: "r3", serviceId: "svc-1", key: "inactive", signalType: "x.c", points: 100, active: false }),
    ];
    const result = scoreBusiness([signal("x.a", false), signal("x.b", true)], testRules, [svc], { ...base, auditDepth: "basic" }, NOW);
    const score = result.serviceScores[0];
    // Inactive rules are ignored; the deep rule counts towards the max even though it is gated.
    expect(score.maxPoints).toBe(40);
    expect(score.rawPoints).toBe(30);
    expect(score.score).toBe(75);
    expect(unavailableReason(score, "b")).toBe("depth_not_reached");
    expect(score.unavailableRules.map((rule) => rule.ruleKey)).not.toContain("inactive");
  });

  it("clamps scores to 0..100 with a normalizer", () => {
    const small = mkService({ id: "svc-1", key: "svc_one", scoreNormalizer: 50 });
    const testRules = [mkRule({ id: "r1", serviceId: "svc-1", key: "a", signalType: "x.a", points: 80 })];
    const high = scoreBusiness([signal("x.a", false)], testRules, [small], base, NOW);
    expect(high.serviceScores[0].score).toBe(100);
    expect(high.serviceScores[0].rawPoints).toBe(80);
    expect(high.overallScore).toBe(100);

    const penalty = [mkRule({ id: "r1", serviceId: "svc-1", key: "a", signalType: "x.a", points: -20 }), mkRule({ id: "r2", serviceId: "svc-1", key: "b", signalType: "x.b", points: 20 })];
    const low = scoreBusiness([signal("x.a", false), signal("x.b", true)], penalty, [small], base, NOW);
    expect(low.serviceScores[0].score).toBe(0);
  });

  it("returns score 0 and low confidence when nothing could be evaluated", () => {
    const testRules = [mkRule({ id: "r1", serviceId: "svc-1", key: "a", signalType: "x.a" })];
    const missing = scoreBusiness([], testRules, [svc], base, NOW);
    expect(missing.serviceScores[0]).toMatchObject({ score: 0, rawPoints: 0, evaluablePoints: 0, confidence: "low" });
    expect(unavailableReason(missing.serviceScores[0], "a")).toBe("signal_missing");
    expect(missing.overallScore).toBe(0);
    expect(missing.confidence).toBe("low");

    const errored = scoreBusiness([makeUnavailableSignal("x.a", { source: "website_audit", status: "error", explanation: "test" })], testRules, [svc], base, NOW);
    expect(unavailableReason(errored.serviceScores[0], "a")).toBe("error");
  });

  it("returns an empty result when no service is selected", () => {
    const result = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, options({ serviceIds: [] }), NOW);
    expect(result.serviceScores).toEqual([]);
    expect(result.primaryServiceId).toBeNull();
    expect(result.primaryServiceKey).toBeNull();
    expect(result.overallScore).toBe(0);
    expect(result.confidence).toBe("low");
    expect(result.digitalGaps.length).toBeGreaterThan(0);
  });

  it("marks low-confidence signals as unavailable instead of evaluating them", () => {
    const testRules = [mkRule({ id: "r1", serviceId: "svc-1", key: "a", signalType: "x.a", minConfidence: "high" })];
    const result = scoreBusiness([signal("x.a", false, { confidence: "medium" })], testRules, [svc], base, NOW);
    expect(unavailableReason(result.serviceScores[0], "a")).toBe("low_confidence");
    expect(result.serviceScores[0].evaluablePoints).toBe(0);
  });

  it("confidence is medium when matched evidence is mostly heuristic", () => {
    const testRules = [
      mkRule({ id: "r1", serviceId: "svc-1", key: "a", signalType: "x.a", points: 60 }),
      mkRule({ id: "r2", serviceId: "svc-1", key: "b", signalType: "x.b", points: 40 }),
    ];
    const heuristic = scoreBusiness([signal("x.a", false, { evidenceType: "heuristic" }), signal("x.b", false, { evidenceType: "observed" })], testRules, [svc], base, NOW);
    expect(heuristic.serviceScores[0].evaluablePoints).toBe(100);
    expect(heuristic.serviceScores[0].confidence).toBe("medium");

    const observed = scoreBusiness([signal("x.a", false, { evidenceType: "derived" }), signal("x.b", false, { evidenceType: "heuristic" })], testRules, [svc], base, NOW);
    expect(observed.serviceScores[0].confidence).toBe("high");

    expect(serviceConfidence(70, 100, 50, 25)).toBe("high");
    expect(serviceConfidence(69, 100, 50, 50)).toBe("medium");
    expect(serviceConfidence(40, 100, 0, 0)).toBe("medium");
    expect(serviceConfidence(39, 100, 39, 39)).toBe("low");
    expect(serviceConfidence(0, 100, 0, 0)).toBe("low");
  });

  it("evaluates exists / not_exists on observation status", () => {
    const testRules = [
      mkRule({ id: "r1", serviceId: "svc-1", key: "has_url", signalType: SIGNAL_TYPES.WEBSITE_URL, operator: "exists", points: 10 }),
      mkRule({ id: "r2", serviceId: "svc-1", key: "no_url", signalType: SIGNAL_TYPES.WEBSITE_URL, operator: "not_exists", points: 10 }),
    ];
    const found = scoreBusiness([signal(SIGNAL_TYPES.WEBSITE_URL, "https://example.test")], testRules, [svc], base, NOW);
    expect(matchedKeys(found.serviceScores[0])).toEqual(["has_url"]);

    const notFound = scoreBusiness([signal(SIGNAL_TYPES.WEBSITE_URL, null, { status: "not_found" })], testRules, [svc], base, NOW);
    expect(matchedKeys(notFound.serviceScores[0])).toEqual(["no_url"]);
    expect(notFound.serviceScores[0].evaluablePoints).toBe(20);

    const foundWithoutValue = scoreBusiness([signal(SIGNAL_TYPES.WEBSITE_URL, null)], testRules, [svc], base, NOW);
    expect(matchedKeys(foundWithoutValue.serviceScores[0])).toEqual(["no_url"]);

    const ambiguous = scoreBusiness([signal(SIGNAL_TYPES.WEBSITE_URL, "https://maybe.test", { status: "ambiguous" })], testRules, [svc], base, NOW);
    expect(matchedKeys(ambiguous.serviceScores[0])).toEqual([]);
    expect(ambiguous.serviceScores[0].evaluablePoints).toBe(20);
  });

  it("breaks primary ties by service sortOrder and ranks secondaries by score", () => {
    const first = mkService({ id: "svc-a", key: "svc_a", sortOrder: 20 });
    const second = mkService({ id: "svc-b", key: "svc_b", sortOrder: 10 });
    const third = mkService({ id: "svc-c", key: "svc_c", sortOrder: 30 });
    const testRules = [
      mkRule({ id: "ra", serviceId: "svc-a", key: "a", signalType: "x.a", points: 10 }),
      mkRule({ id: "rb", serviceId: "svc-b", key: "b", signalType: "x.a", points: 10 }),
      mkRule({ id: "rc1", serviceId: "svc-c", key: "c1", signalType: "x.a", points: 10 }),
      mkRule({ id: "rc2", serviceId: "svc-c", key: "c2", signalType: "x.b", points: 10 }),
    ];
    const result = scoreBusiness([signal("x.a", false), signal("x.b", true)], testRules, [first, second, third], { ...base, serviceIds: ["svc-a", "svc-b", "svc-c"] }, NOW);
    expect(result.serviceScores.map((score) => [score.serviceKey, score.score])).toEqual([
      ["svc_b", 100],
      ["svc_a", 100],
      ["svc_c", 50],
    ]);
    expect(result.primaryServiceKey).toBe("svc_b");
    expect(result.secondaryServiceKeys).toEqual(["svc_a", "svc_c"]);
    // round(0.7 * 100 + 0.3 * mean(100, 100, 50))
    expect(result.overallScore).toBe(95);
  });

  it("uses the newest duplicate signal", () => {
    const testRules = [mkRule({ id: "r1", serviceId: "svc-1", key: "few", signalType: SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, operator: "lt", value: 5 })];
    const older = signal(SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, 2, { detectedAt: "2026-09-17T09:00:00.000Z" });
    const newer = signal(SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, 12, { detectedAt: "2026-09-18T09:00:00.000Z" });
    expect(matchedKeys(scoreBusiness([newer, older], testRules, [svc], base, NOW).serviceScores[0])).toEqual([]);
    expect(matchedKeys(scoreBusiness([older], testRules, [svc], base, NOW).serviceScores[0])).toEqual(["few"]);
  });

  it("falls back to the other language when a localized text is empty and reports the max rule version", () => {
    const testRules = [
      mkRule({ id: "r1", serviceId: "svc-1", key: "a", signalType: "x.a", nameEn: "", explanationEn: null, version: 3 }),
      mkRule({ id: "r2", serviceId: "svc-1", key: "b", signalType: "x.b", nameTr: "", explanationTr: "", version: 2 }),
    ];
    const en = scoreBusiness([signal("x.a", false), signal("x.b", false)], testRules, [svc], { ...base, locale: "en" }, NOW);
    expect(en.serviceScores[0].reasons.map((reason) => [reason.name, reason.explanation])).toEqual([
      ["a tr", "a açıklama"],
      ["b en", "b explanation"],
    ]);
    expect(en.rulesVersion).toBe(3);

    const tr = scoreBusiness([signal("x.b", false)], testRules, [svc], base, NOW);
    expect(tr.serviceScores[0].reasons[0]).toMatchObject({ name: "b en", explanation: "b explanation" });
  });
});
