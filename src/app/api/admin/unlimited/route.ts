import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/context";
import { errorResponse } from "@/lib/api/with-api";
import { setWorkspaceUnlimited } from "@/features/admin/service";
import { setUnlimitedSchema } from "@/features/admin/schemas";
import { ValidationError } from "@/lib/errors";

/**
 * POST /api/admin/unlimited — stops or resumes billing a workspace's credits.
 *
 * Usage is still recorded either way; only the charge changes. The reason lands
 * in `billing_events`, so free usage is never granted without a trail.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requirePlatformAdmin();
    const parsed = setUnlimitedSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Invalid request body");
    const account = await setWorkspaceUnlimited(ctx, parsed.data);
    return NextResponse.json({ data: account });
  } catch (err) {
    return errorResponse(err, { path: "/api/admin/unlimited" });
  }
}
