import { z } from "zod";

import { ok, withApi } from "@/lib/api/with-api";
import { getAnalytics } from "@/features/analytics/queries";

const analyticsQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  scanId: z.uuid().optional(),
  serviceId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
});

/** GET /api/analytics — descriptive counts over a date range. No forecasts. */
export const GET = withApi(
  async ({ ctx, query }) => {
    const result = await getAnalytics(ctx, query);
    return ok(result);
  },
  { query: analyticsQuerySchema },
);
