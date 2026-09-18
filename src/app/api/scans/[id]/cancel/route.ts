import { ok, withApi } from "@/lib/api/with-api";
import { cancelScan } from "@/features/scans/service";

/** POST /api/scans/:id/cancel — stops the run and releases the reservation. */
export const POST = withApi(async ({ ctx, params }) => {
  const scan = await cancelScan(ctx, String(params.id));
  return ok(scan);
});
