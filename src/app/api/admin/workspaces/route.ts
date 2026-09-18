import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/context";
import { errorResponse } from "@/lib/api/with-api";
import { listWorkspaces } from "@/features/admin/service";
import { listWorkspacesQuerySchema } from "@/features/admin/schemas";

/** GET /api/admin/workspaces — platform admin only. */
export async function GET(request: Request) {
  try {
    const ctx = await requirePlatformAdmin();
    const url = new URL(request.url);
    const query = listWorkspacesQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await listWorkspaces(ctx, query);
    return NextResponse.json({ data: result });
  } catch (err) {
    return errorResponse(err, { path: "/api/admin/workspaces" });
  }
}
