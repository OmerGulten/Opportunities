import { NotFoundError } from "@/lib/errors";
import { ok, withApi } from "@/lib/api/with-api";
import { getBusinessDetail } from "@/features/businesses/queries";

/**
 * GET /api/opportunities/:id — the opportunity for a business, with its
 * per-service scores, the evidence behind them and the checks that could not
 * be run. `id` is the business id, which is what the list rows carry.
 */
export const GET = withApi(async ({ ctx, params }) => {
  const detail = await getBusinessDetail(ctx, String(params.id));
  if (!detail) throw new NotFoundError("Business not found");
  if (!detail.opportunity) throw new NotFoundError("This business has not been scored yet");

  return ok({
    businessId: detail.business.id,
    businessName: detail.snapshot?.display_name ?? null,
    opportunity: detail.opportunity,
    serviceScores: detail.serviceScores,
    recommendations: detail.recommendations,
    signals: detail.signals,
    attribution: detail.attribution,
  });
});
