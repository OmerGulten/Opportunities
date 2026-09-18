import { ok, withApi } from "@/lib/api/with-api";
import { listOpportunities } from "@/features/opportunities/queries";
import { opportunityFiltersSchema } from "@/features/opportunities/schemas";

/**
 * POST /api/businesses/search — the same filtered read as GET /api/opportunities,
 * for callers that would otherwise need an unwieldy query string.
 */
export const POST = withApi(
  async ({ ctx, body }) => {
    const result = await listOpportunities(ctx, body);
    return ok(result);
  },
  { body: opportunityFiltersSchema },
);
