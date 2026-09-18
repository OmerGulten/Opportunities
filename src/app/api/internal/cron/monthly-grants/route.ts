import { NextResponse } from "next/server";

import { withInternalApi } from "@/lib/api/with-api";
import { creditKeys, formatGrantPeriod, REFERENCE_TYPES } from "@/lib/credits/keys";
import { getCreditService } from "@/lib/credits/server";
import { logger } from "@/lib/logging";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionRow } from "@/types/db";

/**
 * POST /api/internal/cron/monthly-grants
 *
 * Grants each active subscription its plan credits once per billing period.
 * Protected by INTERNAL_API_SECRET. The grant key includes the period, so
 * running this twice in the same month is a no-op rather than a double grant.
 */
export const POST = withInternalApi(async () => {
  const client = createAdminClient();
  const now = new Date();
  const period = formatGrantPeriod(now);

  const { data: subscriptions, error } = await client
    .from("subscriptions")
    .select("id, workspace_id, plan_id, status, last_grant_period_start, plans(key, monthly_credits)")
    .eq("status", "active")
    .returns<Array<SubscriptionRow & { plans: { key: string; monthly_credits: number } | null }>>();
  if (error) throw error;

  const service = getCreditService();
  let granted = 0;
  let skipped = 0;

  for (const subscription of subscriptions ?? []) {
    const plan = subscription.plans;
    if (!plan || plan.monthly_credits <= 0) {
      skipped += 1;
      continue;
    }
    // Already granted for this period.
    if (subscription.last_grant_period_start && formatGrantPeriod(new Date(subscription.last_grant_period_start)) === period) {
      skipped += 1;
      continue;
    }

    try {
      await service.grant({
        workspaceId: subscription.workspace_id,
        amount: plan.monthly_credits,
        type: "monthly_grant",
        referenceType: REFERENCE_TYPES.plan,
        referenceId: plan.key,
        idempotencyKey: creditKeys.monthlyGrant(subscription.workspace_id, period),
        metadata: { plan: plan.key, period },
      });
      await client.from("subscriptions").update({ last_grant_period_start: now.toISOString() }).eq("id", subscription.id);
      granted += 1;
    } catch (err) {
      logger.error("monthly_grant_failed", {
        workspaceId: subscription.workspace_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("monthly_grants_run", { period, granted, skipped });
  return NextResponse.json({ data: { period, granted, skipped } });
});
