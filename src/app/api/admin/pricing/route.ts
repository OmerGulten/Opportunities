import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/context";
import { errorResponse } from "@/lib/api/with-api";
import { updateCreditPricing } from "@/features/admin/service";
import { updatePricingSchema } from "@/features/admin/schemas";

/** PATCH /api/admin/pricing — credit costs per operation. */
export async function PATCH(request: Request) {
  try {
    const ctx = await requirePlatformAdmin();
    const body = updatePricingSchema.parse(await request.json());
    await updateCreditPricing(ctx, body);
    return NextResponse.json({ data: { updated: body.rules.length } });
  } catch (err) {
    return errorResponse(err, { path: "/api/admin/pricing" });
  }
}
