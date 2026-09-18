import { NotFoundError } from "@/lib/errors";
import { ok, withApi } from "@/lib/api/with-api";
import { getScan } from "@/features/scans/queries";

/** GET /api/scans/:id — full scan detail including targets and recent events. */
export const GET = withApi(async ({ ctx, params }) => {
  const id = String(params.id);
  const scan = await getScan(ctx, id);
  if (!scan) throw new NotFoundError("Scan not found");
  return ok(scan);
});
