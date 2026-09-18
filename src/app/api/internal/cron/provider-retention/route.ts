import { NextResponse } from "next/server";

import { withInternalApi } from "@/lib/api/with-api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/internal/cron/provider-retention
 *
 * Deletes expired provider snapshots in bounded batches. The database function
 * is intentionally small and idempotent so the endpoint can be scheduled
 * repeatedly without a long-running transaction.
 */
export const POST = withInternalApi(async () => {
  const client = createAdminClient();
  let deleted = 0;

  for (let i = 0; i < 20; i += 1) {
    const { data, error } = await client.rpc("purge_expired_provider_cache", { p_limit: 5000 });
    if (error) throw error;
    const count = typeof data === "number" ? data : 0;
    deleted += count;
    if (count < 5000) break;
  }

  return NextResponse.json({ data: { deleted } });
});
