import { z } from "zod";

/**
 * Scan input validation. Shared by the API route, the server service and the
 * wizard form, so the client cannot submit anything the server would reject.
 */

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** GeoJSON Polygon with a single outer ring. Coordinates are [lng, lat]. */
export const geoPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z
    .array(z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(4).max(200))
    .min(1)
    .max(1),
});

export const websiteFilterSchema = z.enum(["any", "none", "weak", "strong"]);
export const instagramFilterSchema = z.enum(["any", "not_found", "found", "not_checked"]);
export const googleFilterSchema = z.enum(["any", "incomplete", "low_reviews", "low_rating", "missing_hours", "missing_photos", "missing_website"]);

export const scanFiltersSchema = z.object({
  website: websiteFilterSchema.default("any"),
  instagram: instagramFilterSchema.default("any"),
  google: z.array(googleFilterSchema).max(6).default([]),
  minReviews: z.number().int().min(0).max(100_000).nullable().default(null),
  maxReviews: z.number().int().min(0).max(100_000).nullable().default(null),
  minRating: z.number().min(0).max(5).nullable().default(null),
  maxRating: z.number().min(0).max(5).nullable().default(null),
  includeBenchmark: z.boolean().default(false),
});

export type ScanFilters = z.infer<typeof scanFiltersSchema>;

export const auditDepthSchema = z.enum(["discovery", "basic", "deep"]);
export const locationMethodSchema = z.enum(["place", "radius", "polygon"]);

export const createScanSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    locationMethod: locationMethodSchema,
    placeLabel: z.string().trim().max(200).nullable().optional(),
    center: geoPointSchema.nullable().optional(),
    radiusM: z.number().int().min(200).max(50_000).nullable().optional(),
    polygon: geoPolygonSchema.nullable().optional(),
    categoryIds: z.array(z.uuid()).min(1, "Select at least one category").max(10),
    serviceIds: z.array(z.uuid()).min(1, "Select at least one service").max(20),
    auditDepth: auditDepthSchema.default("basic"),
    maxBusinesses: z.number().int().min(1).max(500).default(100),
    filters: scanFiltersSchema.default(scanFiltersSchema.parse({})),
  })
  .superRefine((value, ctx) => {
    // Geometry requirements depend on the chosen method; enforce them here so a
    // malformed area can never reach the coverage planner.
    if (value.locationMethod === "polygon") {
      if (!value.polygon) ctx.addIssue({ code: "custom", path: ["polygon"], message: "A polygon is required for polygon scans" });
    } else {
      if (!value.center) ctx.addIssue({ code: "custom", path: ["center"], message: "A centre point is required" });
      if (!value.radiusM) ctx.addIssue({ code: "custom", path: ["radiusM"], message: "A radius is required" });
    }
    if (value.filters.minRating !== null && value.filters.maxRating !== null && value.filters.minRating > value.filters.maxRating) {
      ctx.addIssue({ code: "custom", path: ["filters", "minRating"], message: "Minimum rating cannot exceed the maximum" });
    }
    if (value.filters.minReviews !== null && value.filters.maxReviews !== null && value.filters.minReviews > value.filters.maxReviews) {
      ctx.addIssue({ code: "custom", path: ["filters", "minReviews"], message: "Minimum review count cannot exceed the maximum" });
    }
  });

export type CreateScanInput = z.infer<typeof createScanSchema>;

/** Estimate requests reuse the creation shape without the service selection. */
export const estimateScanSchema = createScanSchema;
export type EstimateScanInput = z.infer<typeof estimateScanSchema>;

export const listScansQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListScansQuery = z.infer<typeof listScansQuerySchema>;
