import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/context";
import { errorResponse } from "@/lib/api/with-api";
import { updateFeatureFlags } from "@/features/admin/service";
import { updateFeatureFlagsSchema } from "@/features/admin/schemas";
import { getFeatureFlags } from "@/lib/db/settings";

export async function GET() {
  try {
    await requirePlatformAdmin();
    return NextResponse.json({ data: await getFeatureFlags() });
  } catch (err) {
    return errorResponse(err, { path: "/api/admin/flags" });
  }
}

/** PATCH /api/admin/flags — toggles platform features. */
export async function PATCH(request: Request) {
  try {
    const ctx = await requirePlatformAdmin();
    const body = updateFeatureFlagsSchema.parse(await request.json());
    const flags = await updateFeatureFlags(ctx, body);
    return NextResponse.json({ data: flags });
  } catch (err) {
    return errorResponse(err, { path: "/api/admin/flags" });
  }
}
