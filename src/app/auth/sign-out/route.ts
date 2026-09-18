import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { CURRENT_WORKSPACE_COOKIE } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createLogger } from "@/lib/logging";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const log = createLogger({ scope: "auth.sign-out" });

/** POST-only so a prefetch or an image tag can never end a session. */
export async function POST(request: NextRequest) {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (error) {
      log.warn("sign_out_failed", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  const cookieStore = await cookies();
  cookieStore.delete(CURRENT_WORKSPACE_COOKIE);

  // 303 so the browser follows up with a GET.
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
