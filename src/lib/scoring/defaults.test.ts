import { describe, expect, it } from "vitest";

import { SIGNAL_TYPES } from "@/types/signals";

import { DEFAULT_RULES, DEFAULT_SERVICES, defaultRuleId, defaultServiceId, loadDefaultRules } from "./defaults";
import { isRuleOperator } from "./operators";

const KNOWN_SIGNAL_TYPES = new Set<string>(Object.values(SIGNAL_TYPES));

describe("default services and rules", () => {
  it("mirror the seed: six services and forty-six rules", () => {
    expect(DEFAULT_SERVICES.map((service) => service.key)).toEqual(["website_development", "seo", "social_media", "google_business", "review_management", "branding"]);
    expect(DEFAULT_RULES).toHaveLength(46);

    const perService = new Map<string, number>();
    for (const rule of DEFAULT_RULES) perService.set(rule.serviceKey, (perService.get(rule.serviceKey) ?? 0) + 1);
    expect(Object.fromEntries(perService)).toEqual({
      website_development: 8,
      seo: 12,
      social_media: 7,
      google_business: 7,
      review_management: 6,
      branding: 6,
    });
  });

  it("only reference known services, signal types and operators", () => {
    const serviceKeys = new Set(DEFAULT_SERVICES.map((service) => service.key));
    const seen = new Set<string>();
    for (const rule of DEFAULT_RULES) {
      expect(serviceKeys.has(rule.serviceKey)).toBe(true);
      expect(KNOWN_SIGNAL_TYPES.has(rule.signalType)).toBe(true);
      expect(isRuleOperator(rule.operator)).toBe(true);
      expect(rule.points).toBeGreaterThan(0);
      expect(rule.active).toBe(true);
      expect(rule.version).toBe(1);
      expect(rule.nameTr.length).toBeGreaterThan(0);
      expect(rule.nameEn.length).toBeGreaterThan(0);
      expect(rule.explanationTr?.length ?? 0).toBeGreaterThan(0);
      expect(rule.explanationEn?.length ?? 0).toBeGreaterThan(0);
      const natural = `${rule.serviceKey}:${rule.key}`;
      expect(seen.has(natural)).toBe(false);
      seen.add(natural);
    }
  });

  it("spot-checks values against the seed", () => {
    const noWebsite = DEFAULT_RULES.find((rule) => rule.serviceKey === "website_development" && rule.key === "no_website");
    expect(noWebsite).toMatchObject({ operator: "in", value: ["not_found", "invalid", "unreachable"], points: 55, minConfidence: "medium", requiresDepth: "discovery", sortOrder: 10 });

    const midMobile = DEFAULT_RULES.find((rule) => rule.serviceKey === "seo" && rule.key === "mid_mobile_performance");
    expect(midMobile).toMatchObject({ operator: "between", value: [50, 89], points: 10, minConfidence: "low", requiresDepth: "deep" });

    const lowResponse = DEFAULT_RULES.find((rule) => rule.serviceKey === "review_management" && rule.key === "low_response_rate");
    expect(lowResponse).toMatchObject({ signalType: "google.review_response_rate", operator: "lt", value: 0.3, points: 30, minConfidence: "low", requiresDepth: "basic" });

    const noHttps = DEFAULT_RULES.find((rule) => rule.serviceKey === "website_development" && rule.key === "no_https");
    expect(noHttps).toMatchObject({ operator: "is_false", value: null, points: 10, minConfidence: "high" });
  });

  it("every service normalizes to 100 like the seed", () => {
    for (const service of DEFAULT_SERVICES) expect(service.scoreNormalizer).toBe(100);
  });
});

describe("loadDefaultRules", () => {
  it("assigns database ids where mapped and synthetic ids otherwise", () => {
    const { services, rules } = loadDefaultRules({ seo: "11111111-1111-1111-1111-111111111111" });
    const seo = services.find((service) => service.key === "seo");
    const branding = services.find((service) => service.key === "branding");
    expect(seo?.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(branding?.id).toBe(defaultServiceId("branding"));
    expect(rules.filter((rule) => rule.serviceId === seo?.id)).toHaveLength(12);
    expect(rules.find((rule) => rule.key === "no_favicon")?.id).toBe(defaultRuleId("branding", "no_favicon"));
    expect(rules).toHaveLength(DEFAULT_RULES.length);
    for (const rule of rules) expect(services.some((service) => service.id === rule.serviceId)).toBe(true);
  });

  it("returns fresh copies so callers cannot mutate the seed", () => {
    const first = loadDefaultRules();
    const rule = first.rules.find((candidate) => Array.isArray(candidate.value));
    expect(rule).toBeDefined();
    (rule?.value as string[]).push("mutated");
    const second = loadDefaultRules();
    expect(second.rules.find((candidate) => candidate.id === rule?.id)?.value).toEqual(["not_found", "invalid", "unreachable"]);
  });
});
