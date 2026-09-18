import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/context";
import { errorResponse } from "@/lib/api/with-api";
import { toggleService } from "@/features/admin/service";
import { toggleServiceSchema } from "@/features/admin/schemas";

/** PATCH /api/admin/services — enables or disables a sellable service platform-wide. */
export async function PATCH(request: Request) {
  try {
    const ctx = await requirePlatformAdmin();
    const body = toggleServiceSchema.parse(await request.json());
    const service = await toggleService(ctx, body);
    return NextResponse.json({ data: service });
  } catch (err) {
    return errorResponse(err, { path: "/api/admin/services" });
  }
}
