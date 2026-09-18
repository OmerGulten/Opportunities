import { z } from "zod";

import { ok, withApi } from "@/lib/api/with-api";
import { CREDIT_PACKS, completeMockPurchase, getBillingProvider, getSubscriptionProvider, isRealPaymentsEnabled } from "@/lib/billing";
import { listPlans } from "@/lib/db/reference";

/** GET /api/billing — plan, packs and subscription state for the workspace. */
export const GET = withApi(async ({ ctx }) => {
  const [plans, subscription, realPayments] = await Promise.all([
    listPlans(ctx.supabase),
    getSubscriptionProvider().getSubscription(ctx.workspace.id),
    isRealPaymentsEnabled(),
  ]);
  return ok({ plans, packs: CREDIT_PACKS, subscription, realPayments, provider: getBillingProvider().name });
});

const billingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("change_plan"), planKey: z.string().min(1).max(40) }),
  z.object({ action: z.literal("cancel"), atPeriodEnd: z.boolean().default(true) }),
  z.object({ action: z.literal("buy_credits"), packKey: z.string().min(1).max(40), reference: z.uuid() }),
]);

/**
 * POST /api/billing — plan changes, cancellation and mock top-ups.
 * Admin-only; while payments are flagged off these apply without money moving.
 */
export const POST = withApi(
  async ({ ctx, body }) => {
    if (body.action === "change_plan") {
      const subscription = await getSubscriptionProvider().changePlan({ workspaceId: ctx.workspace.id, planKey: body.planKey, actorId: ctx.user.id });
      return ok({ subscription });
    }
    if (body.action === "cancel") {
      const subscription = await getSubscriptionProvider().cancel({ workspaceId: ctx.workspace.id, atPeriodEnd: body.atPeriodEnd, actorId: ctx.user.id });
      return ok({ subscription });
    }
    const result = await completeMockPurchase({
      workspaceId: ctx.workspace.id,
      packKey: body.packKey,
      actorId: ctx.user.id,
      reference: body.reference,
    });
    return ok(result);
  },
  { body: billingActionSchema, role: "admin" },
);
