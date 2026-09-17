import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "@/lib/config/env";

let adminClient: SupabaseClient | null = null;

/**
 * Service-role client. BYPASSES RLS. Use only in:
 *  - workflow steps (no user session; workspace derived from the scan row)
 *  - internal endpoints protected by INTERNAL_API_SECRET
 *  - platform admin server code after `requirePlatformAdmin()`
 *  - functions revoked from `authenticated` (credit_apply, rate_limit_hit, ...)
 * Never import from client code. Never pass to UI.
 */
export function createAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin client is not configured (SUPABASE_SERVICE_ROLE_KEY)");
  }
  adminClient = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-opportunityos-client": "admin" } },
  });
  return adminClient;
}

export function isAdminClientConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && serverEnv().SUPABASE_SERVICE_ROLE_KEY);
}
