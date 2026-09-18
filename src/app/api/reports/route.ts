import { created, ok, withApi } from "@/lib/api/with-api";
import { createReportSchema, listReportsQuerySchema, revokeReportSchema } from "@/features/reports/schemas";
import { createReport, listReports, revokeReport } from "@/features/reports/service";

/** GET /api/reports — report links issued by this workspace. */
export const GET = withApi(
  async ({ ctx, query }) => {
    const reports = await listReports(ctx, query.businessId);
    return ok(reports);
  },
  { query: listReportsQuerySchema },
);

/** POST /api/reports — issues a shareable read-only report link. */
export const POST = withApi(
  async ({ ctx, body }) => {
    const result = await createReport(ctx, body);
    return created(result);
  },
  { body: createReportSchema },
);

/** DELETE /api/reports — revokes a link immediately. */
export const DELETE = withApi(
  async ({ ctx, body }) => {
    const report = await revokeReport(ctx, body.reportId);
    return ok(report);
  },
  { body: revokeReportSchema },
);
