"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CURRENT_WORKSPACE_COOKIE } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createLogger } from "@/lib/logging";
import { createClient } from "@/lib/supabase/server";

const log = createLogger({ scope: "auth.actions" });

/**
 * Ends the session and clears the workspace preference cookie, then returns to
 * the public landing page. Used by the user menu; `/auth/sign-out` offers the
 * same behaviour as a POST route for non-JS clients.
 */
export async function signOut(): Promise<void> {
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
  redirect("/");
}
