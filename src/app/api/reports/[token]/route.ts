import { NextResponse } from "next/server";

import { withPublicApi } from "@/lib/api/with-api";
import { getPublicReport } from "@/features/reports/public";

/**
 * GET /api/reports/:token — anonymous read of a shared report.
 * The token is the authorisation; revoked and expired links are refused.
 */
export const GET = withPublicApi(
  async ({ params }) => {
    const lookup = await getPublicReport(String(params.token));
    if (lookup.status !== "ok") {
      return NextResponse.json({ error: { code: "not_found", message: lookup.status } }, { status: lookup.status === "not_found" ? 404 : 410 });
    }
    return NextResponse.json({ data: lookup.report });
  },
  { rateLimit: "public_report" },
);
