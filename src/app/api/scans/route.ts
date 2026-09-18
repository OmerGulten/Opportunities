import { created, ok, withApi } from "@/lib/api/with-api";
import { listScans } from "@/features/scans/queries";
import { createScan } from "@/features/scans/service";
import { createScanSchema, listScansQuerySchema } from "@/features/scans/schemas";
import type { ScanStatus } from "@/types/common";

/** GET /api/scans — scans of the current workspace. */
export const GET = withApi(
  async ({ ctx, query }) => {
    const result = await listScans(ctx, {
      status: query.status as ScanStatus | "active" | "terminal" | undefined,
      limit: query.limit,
      offset: query.offset,
    });
    return ok(result);
  },
  { query: listScansQuerySchema },
);

/** POST /api/scans — creates a scan and starts its durable workflow. */
export const POST = withApi(
  async ({ ctx, body }) => {
    const result = await createScan(ctx, body);
    return created(result);
  },
  { body: createScanSchema, rateLimit: "scan_create" },
);
