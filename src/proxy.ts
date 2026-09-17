import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 proxy (formerly middleware). Refreshes the Supabase session and
 * redirects unauthenticated users away from the app. Workflow DevKit internal
 * routes (.well-known/workflow) and static assets are excluded.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|\\.well-known/workflow|api/internal|report/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
