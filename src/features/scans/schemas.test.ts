import { describe, expect, it } from "vitest";

import { createScanSchema, scanFiltersSchema } from "./schemas";

const CATEGORY = "11111111-1111-4111-8111-111111111111";
const SERVICE = "22222222-2222-4222-9222-222222222222";

const radiusScan = {
  locationMethod: "radius" as const,
  center: { lat: 40.9903, lng: 29.029 },
  radiusM: 5000,
  categoryIds: [CATEGORY],
  serviceIds: [SERVICE],
};

const squareRing = [
  [29.02, 40.98],
  [29.04, 40.98],
  [29.04, 41.0],
  [29.02, 41.0],
  [29.02, 40.98],
];

describe("createScanSchema", () => {
  it("accepts a centre + radius scan and applies defaults", () => {
    const parsed = createScanSchema.parse(radiusScan);
    expect(parsed.auditDepth).toBe("basic");
    expect(parsed.maxBusinesses).toBe(100);
    expect(parsed.filters.website).toBe("any");
    expect(parsed.filters.google).toEqual([]);
    expect(parsed.filters.includeBenchmark).toBe(false);
  });

  it("requires a centre and radius when the method is not polygon", () => {
    const result = createScanSchema.safeParse({ ...radiusScan, center: undefined, radiusM: undefined });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toContain("center");
    expect(paths).toContain("radiusM");
  });

  it("requires a polygon for polygon scans", () => {
    const result = createScanSchema.safeParse({ ...radiusScan, locationMethod: "polygon", center: undefined, radiusM: undefined });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path.join(".") === "polygon")).toBe(true);
  });

  it("accepts a closed polygon ring", () => {
    const parsed = createScanSchema.parse({
      ...radiusScan,
      locationMethod: "polygon",
      center: undefined,
      radiusM: undefined,
      polygon: { type: "Polygon", coordinates: [squareRing] },
    });
    expect(parsed.polygon?.coordinates[0]).toHaveLength(5);
  });

  it("rejects a ring with fewer than four positions", () => {
    const result = createScanSchema.safeParse({
      ...radiusScan,
      locationMethod: "polygon",
      polygon: { type: "Polygon", coordinates: [squareRing.slice(0, 3)] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects coordinates outside the valid ranges", () => {
    expect(createScanSchema.safeParse({ ...radiusScan, center: { lat: 95, lng: 29 } }).success).toBe(false);
    expect(createScanSchema.safeParse({ ...radiusScan, center: { lat: 40, lng: 200 } }).success).toBe(false);
  });

  it("requires at least one category and one service", () => {
    expect(createScanSchema.safeParse({ ...radiusScan, categoryIds: [] }).success).toBe(false);
    expect(createScanSchema.safeParse({ ...radiusScan, serviceIds: [] }).success).toBe(false);
  });

  it("bounds the radius to what the provider supports", () => {
    expect(createScanSchema.safeParse({ ...radiusScan, radiusM: 100 }).success).toBe(false);
    expect(createScanSchema.safeParse({ ...radiusScan, radiusM: 60_000 }).success).toBe(false);
    expect(createScanSchema.safeParse({ ...radiusScan, radiusM: 50_000 }).success).toBe(true);
  });

  it("rejects inverted rating and review thresholds", () => {
    const badRating = createScanSchema.safeParse({
      ...radiusScan,
      filters: scanFiltersSchema.parse({ minRating: 4.5, maxRating: 3 }),
    });
    expect(badRating.success).toBe(false);

    const badReviews = createScanSchema.safeParse({
      ...radiusScan,
      filters: scanFiltersSchema.parse({ minReviews: 100, maxReviews: 10 }),
    });
    expect(badReviews.success).toBe(false);
  });

  it("accepts thresholds that are the right way round", () => {
    const parsed = createScanSchema.parse({
      ...radiusScan,
      filters: scanFiltersSchema.parse({ minRating: 3, maxRating: 4.5, minReviews: 10, maxReviews: 500, google: ["missing_hours", "low_rating"] }),
    });
    expect(parsed.filters.google).toEqual(["missing_hours", "low_rating"]);
    expect(parsed.filters.minRating).toBe(3);
  });

  it("rejects unknown filter values", () => {
    expect(createScanSchema.safeParse({ ...radiusScan, filters: { website: "excellent" } }).success).toBe(false);
    expect(createScanSchema.safeParse({ ...radiusScan, auditDepth: "extreme" }).success).toBe(false);
  });
});
