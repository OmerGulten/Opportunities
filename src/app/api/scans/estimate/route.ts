import { ok, withApi } from "@/lib/api/with-api";
import { estimateScanSchema } from "@/features/scans/schemas";
import { estimateScan } from "@/features/scans/service";

/** POST /api/scans/estimate — coverage plan and credit estimate, nothing is written. */
export const POST = withApi(
  async ({ ctx, body }) => {
    const estimate = await estimateScan(ctx, body);
    return ok(estimate);
  },
  { body: estimateScanSchema },
);
