import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/context";
import { errorResponse } from "@/lib/api/with-api";
import { getPlatformUsage } from "@/features/admin/service";

/** GET /api/admin/usage — platform-wide counters and external-call cost estimates. */
export async function GET(request: Request) {
  try {
    const ctx = await requirePlatformAdmin();
    const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
    const usage = await getPlatformUsage(ctx, Number.isFinite(days) ? Math.min(365, Math.max(1, days)) : 30);
    return NextResponse.json({ data: usage });
  } catch (err) {
    return errorResponse(err, { path: "/api/admin/usage" });
  }
}
