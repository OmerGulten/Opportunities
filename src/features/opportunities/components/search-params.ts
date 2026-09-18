import {
  DEFAULT_OPPORTUNITY_FILTERS,
  opportunityFiltersSchema,
  type OpportunityFilters,
} from "../schemas";

/**
 * Bridges Next's `searchParams` to `opportunityFiltersSchema`.
 *
 * The URL is the single source of truth for the list state (nuqs writes it on
 * the client, this parses it on the server). Empty strings are dropped so an
 * optional uuid filter that the user cleared does not fail validation, and an
 * unparsable URL falls back to the defaults instead of erroring the page.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseListSearchParams(params: RawSearchParams): OpportunityFilters {
  const input: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      const cleaned = value.filter((entry) => entry.trim() !== "");
      if (cleaned.length > 0) input[key] = cleaned;
      continue;
    }
    if (value.trim() === "") continue;
    input[key] = value;
  }

  const parsed = opportunityFiltersSchema.safeParse(input);
  return parsed.success ? parsed.data : DEFAULT_OPPORTUNITY_FILTERS;
}

/** How many filters differ from the defaults (pagination and sort excluded). */
export function activeFilterCount(filters: OpportunityFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (filters.scanId) count += 1;
  if (filters.serviceId) count += 1;
  if (filters.categoryId) count += 1;
  if (filters.city) count += 1;
  if (filters.district) count += 1;
  if (filters.minScore !== undefined) count += 1;
  if (filters.maxScore !== undefined) count += 1;
  if (filters.minServiceScore !== undefined) count += 1;
  if (filters.website !== "any") count += 1;
  if (filters.instagram !== "any") count += 1;
  if (filters.pipeline !== "any") count += 1;
  if (filters.includeIgnored) count += 1;
  count += filters.gaps.length;
  return count;
}
