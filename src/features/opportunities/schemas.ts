import { z } from "zod";

/**
 * Opportunity list filtering. Every filter is URL-addressable so a filtered view
 * can be shared and survives navigating to a business and back.
 */

export const opportunitySortSchema = z.enum([
  "score_desc",
  "score_asc",
  "name_asc",
  "name_desc",
  "recent",
  "reviews_desc",
  "rating_asc",
  "last_contacted",
]);

export const websiteStatusFilterSchema = z.enum(["any", "found", "not_found", "unreachable", "invalid", "not_checked"]);
export const instagramStatusFilterSchema = z.enum(["any", "found", "not_found", "not_checked", "unavailable", "ambiguous"]);
export const pipelineFilterSchema = z.enum(["any", "none", "in_pipeline", "contacted", "not_contacted", "won", "lost"]);
export const digitalGapFilterSchema = z.enum([
  "no_website",
  "weak_website",
  "no_https",
  "no_instagram",
  "inactive_instagram",
  "google_incomplete",
  "low_reviews",
  "low_rating",
  "missing_hours",
  "few_photos",
  "slow_mobile",
  "unanswered_reviews",
]);

/**
 * Query params arrive either repeated (`gaps=a&gaps=b`) or comma-separated
 * (`gaps=a,b`). Normalise both to a string list before validating the members.
 */
const csvStrings = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return [] as string[];
    const list = Array.isArray(value) ? value : value.split(",");
    return list.map((entry) => entry.trim()).filter(Boolean);
  });

export const opportunityFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  scanId: z.uuid().optional(),
  serviceId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  city: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  /** Minimum score for `serviceId` specifically, rather than the overall score. */
  minServiceScore: z.coerce.number().int().min(0).max(100).optional(),
  website: websiteStatusFilterSchema.default("any"),
  instagram: instagramStatusFilterSchema.default("any"),
  gaps: csvStrings.pipe(z.array(digitalGapFilterSchema)).default([]),
  pipeline: pipelineFilterSchema.default("any"),
  includeIgnored: z.coerce.boolean().default(false),
  sort: opportunitySortSchema.default("score_desc"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type OpportunityFilters = z.infer<typeof opportunityFiltersSchema>;

export const DEFAULT_OPPORTUNITY_FILTERS: OpportunityFilters = opportunityFiltersSchema.parse({});

export const ignoreBusinessSchema = z.object({
  businessId: z.uuid(),
  ignored: z.boolean(),
});

export type IgnoreBusinessRequest = z.infer<typeof ignoreBusinessSchema>;
