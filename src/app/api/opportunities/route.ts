import { ok, withApi } from "@/lib/api/with-api";
import { listOpportunities } from "@/features/opportunities/queries";
import { opportunityFiltersSchema } from "@/features/opportunities/schemas";

/** GET /api/opportunities — filtered, sorted, paginated opportunity list. */
export const GET = withApi(
  async ({ ctx, query }) => {
    const result = await listOpportunities(ctx, query);
    return ok(result);
  },
  { query: opportunityFiltersSchema },
);
