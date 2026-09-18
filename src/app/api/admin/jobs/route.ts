import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/context";
import { errorResponse } from "@/lib/api/with-api";
import { listFailedJobs } from "@/features/admin/service";
import { listFailedJobsQuerySchema } from "@/features/admin/schemas";

/** GET /api/admin/jobs — failed workflow jobs, for diagnosing a partial scan. */
export async function GET(request: Request) {
  try {
    const ctx = await requirePlatformAdmin();
    const query = listFailedJobsQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const jobs = await listFailedJobs(ctx, query);
    return NextResponse.json({ data: jobs });
  } catch (err) {
    return errorResponse(err, { path: "/api/admin/jobs" });
  }
}
