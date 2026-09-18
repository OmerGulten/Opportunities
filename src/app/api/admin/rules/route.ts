import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/context";
import { errorResponse } from "@/lib/api/with-api";
import { updateServiceRule } from "@/features/admin/service";
import { updateServiceRuleSchema } from "@/features/admin/schemas";

/**
 * PATCH /api/admin/rules — edits a scoring rule.
 * Existing opportunities keep the version they were scored with.
 */
export async function PATCH(request: Request) {
  try {
    const ctx = await requirePlatformAdmin();
    const body = updateServiceRuleSchema.parse(await request.json());
    const rule = await updateServiceRule(ctx, body);
    return NextResponse.json({ data: rule });
  } catch (err) {
    return errorResponse(err, { path: "/api/admin/rules" });
  }
}
