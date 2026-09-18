import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/context";
import { errorResponse } from "@/lib/api/with-api";
import { adjustCredits } from "@/features/admin/service";
import { grantCreditsSchema } from "@/features/admin/schemas";

/** POST /api/admin/credits — grants or removes credits through the immutable ledger. */
export async function POST(request: Request) {
  try {
    const ctx = await requirePlatformAdmin();
    const body = grantCreditsSchema.parse(await request.json());
    const entry = await adjustCredits(ctx, body);
    return NextResponse.json({ data: entry });
  } catch (err) {
    return errorResponse(err, { path: "/api/admin/credits" });
  }
}
