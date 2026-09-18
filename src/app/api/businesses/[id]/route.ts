import { NotFoundError } from "@/lib/errors";
import { ok, withApi } from "@/lib/api/with-api";
import { getBusinessDetail } from "@/features/businesses/queries";

/** GET /api/businesses/:id — full profile: provider data, audits, scores, CRM. */
export const GET = withApi(async ({ ctx, params }) => {
  const detail = await getBusinessDetail(ctx, String(params.id));
  if (!detail) throw new NotFoundError("Business not found");
  return ok(detail);
});
