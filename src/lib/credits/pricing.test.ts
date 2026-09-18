import { describe, expect, it } from "vitest";

import type { CreditPricingRuleRow } from "@/types/db";

import { buildPricingTable, DEFAULT_PRICING_TABLE, estimateBusinessCount, estimateScanCredits, perBusinessCost } from "./pricing";

function rule(key: string, cost: number, active = true): CreditPricingRuleRow {
  return { id: `rule-${key}`, key, name: key, cost, unit: "per_business", active };
}

describe("buildPricingTable", () => {
  it("falls back to defaults for missing keys", () => {
    expect(buildPricingTable([])).toEqual({ discovery: 1, basic_audit: 2, deep_audit: 4, ai_message: 1, report: 1, competitor_benchmark: 3 });
    expect(buildPricingTable([])).toEqual(DEFAULT_PRICING_TABLE);
  });

  it("applies active rows, ignores inactive / unknown / invalid ones and accepts zero cost", () => {
    const table = buildPricingTable([
      rule("discovery", 2),
      rule("deep_audit", 0),
      rule("competitor_benchmark", 9, false),
      rule("mystery", 7),
      rule("report", -1),
      rule("ai_message", 1.5),
    ]);
    expect(table).toEqual({ discovery: 2, basic_audit: 2, deep_audit: 0, ai_message: 1, report: 1, competitor_benchmark: 3 });
  });
});

describe("perBusinessCost", () => {
  it("adds the audit cost on top of discovery", () => {
    expect(perBusinessCost("discovery", DEFAULT_PRICING_TABLE)).toBe(1);
    expect(perBusinessCost("basic", DEFAULT_PRICING_TABLE)).toBe(3);
    expect(perBusinessCost("deep", DEFAULT_PRICING_TABLE)).toBe(5);
  });
});

describe("estimateScanCredits", () => {
  it("discovery depth", () => {
    const e = estimateScanCredits({ estimatedBusinesses: 10, depth: "discovery" }, DEFAULT_PRICING_TABLE);
    expect(e).toEqual({
      perBusiness: 1,
      businesses: 10,
      subtotal: 10,
      benchmark: 0,
      total: 10,
      breakdown: [{ key: "discovery", unitCost: 1, quantity: 10, total: 10 }],
    });
  });

  it("basic depth", () => {
    const e = estimateScanCredits({ estimatedBusinesses: 10, depth: "basic", includeBenchmark: false }, DEFAULT_PRICING_TABLE);
    expect(e.perBusiness).toBe(3);
    expect(e.subtotal).toBe(30);
    expect(e.total).toBe(30);
    expect(e.breakdown.map((l) => l.key)).toEqual(["discovery", "basic_audit"]);
  });

  it("deep depth with competitor benchmark", () => {
    const e = estimateScanCredits({ estimatedBusinesses: 10, depth: "deep", includeBenchmark: true }, DEFAULT_PRICING_TABLE);
    expect(e.perBusiness).toBe(5);
    expect(e.subtotal).toBe(50);
    expect(e.benchmark).toBe(30);
    expect(e.total).toBe(80);
    expect(e.breakdown).toEqual([
      { key: "discovery", unitCost: 1, quantity: 10, total: 10 },
      { key: "deep_audit", unitCost: 4, quantity: 10, total: 40 },
      { key: "competitor_benchmark", unitCost: 3, quantity: 10, total: 30 },
    ]);
    expect(e.breakdown.reduce((sum, l) => sum + l.total, 0)).toBe(e.total);
  });

  it("uses the supplied table and sanitises the business count", () => {
    const table = buildPricingTable([rule("discovery", 2), rule("basic_audit", 5)]);
    expect(estimateScanCredits({ estimatedBusinesses: 7.9, depth: "basic" }, table)).toMatchObject({ perBusiness: 7, businesses: 7, total: 49 });
    expect(estimateScanCredits({ estimatedBusinesses: -3, depth: "deep" }, table)).toMatchObject({ businesses: 0, total: 0 });
    expect(estimateScanCredits({ estimatedBusinesses: Number.NaN, depth: "deep" }, table)).toMatchObject({ businesses: 0, total: 0 });
  });
});

describe("estimateBusinessCount", () => {
  it("scales with cells x categories x provider page size x fill factor", () => {
    expect(estimateBusinessCount({ cells: 4, categories: 3, maxBusinesses: 200 })).toBe(144);
    expect(estimateBusinessCount({ cells: 4, categories: 3, maxBusinesses: 200, providerMaxPerCall: 10 })).toBe(72);
  });

  it("caps at maxBusinesses", () => {
    expect(estimateBusinessCount({ cells: 20, categories: 5, maxBusinesses: 200 })).toBe(200);
    expect(estimateBusinessCount({ cells: 1, categories: 1, maxBusinesses: 5 })).toBe(5);
  });

  it("returns at least 1 when there is something to search and 0 otherwise", () => {
    expect(estimateBusinessCount({ cells: 1, categories: 1, maxBusinesses: 200, providerMaxPerCall: 1 })).toBe(1);
    expect(estimateBusinessCount({ cells: 0, categories: 3, maxBusinesses: 200 })).toBe(0);
    expect(estimateBusinessCount({ cells: 3, categories: 0, maxBusinesses: 200 })).toBe(0);
  });
});
