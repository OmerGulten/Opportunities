import { ok, withApi } from "@/lib/api/with-api";
import { retryScan } from "@/features/scans/service";

/** POST /api/scans/:id/retry — restarts a failed, cancelled or partial scan. */
export const POST = withApi(
  async ({ ctx, params }) => {
    const scan = await retryScan(ctx, String(params.id));
    return ok(scan);
  },
  { rateLimit: "scan_create" },
);
