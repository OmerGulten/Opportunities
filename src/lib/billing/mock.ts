import "server-only";

import { randomUUID } from "node:crypto";

import { recordActivity } from "@/lib/activity";
import { creditKeys, formatGrantPeriod, REFERENCE_TYPES } from "@/lib/credits/keys";
import { getCreditService } from "@/lib/credits/server";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanRow, SubscriptionRow } from "@/types/db";

import type { BillingEvent, BillingProvider, CheckoutSession, CreditPack, StartCheckoutInput, Subscription, SubscriptionProvider } from "./types";

/**
 * Development billing provider.
 *
 * Plan changes and top-ups are applied directly with no money moving, so the
 * whole billing surface is exercisable before a payment vendor exists. It is
 * only selected while the `real_payments` feature flag is off.
 */

const CREDIT_PACKS: CreditPack[] = [
  { key: "pack_250", credits: 250, price: 199, currency: "TRY" },
  { key: "pack_1000", credits: 1000, price: 699, currency: "TRY" },
  { key: "pack_5000", credits: 5000, price: 2999, currency: "TRY" },
];

export function createMockBillingProvider(): BillingProvider {
  return {
    name: "mock",
    isMock: true,

    async listCreditPacks() {
      return CREDIT_PACKS;
    },

    async startCheckout(input: StartCheckoutInput): Promise<CheckoutSession> {
      const reference = randomUUID();
      // No redirect to a payment page: the app confirms the mock purchase itself.
      const url = `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}mock_checkout=${reference}`;
      logger.info("mock_checkout_started", { workspaceId: input.workspaceId, planKey: input.planKey, packKey: input.packKey, reference });
      return { url, reference, provider: "mock", isMock: true };
    },

    async parseWebhook(): Promise<BillingEvent | null> {
      // The mock provider has no external callers; purchases are confirmed in-app.
      return null;
    },
  };
}

/** Applies a mock credit purchase. Idempotent through the payment reference. */
export async function completeMockPurchase(input: { workspaceId: string; packKey: string; actorId: string; reference: string }): Promise<{ credits: number }> {
  const pack = CREDIT_PACKS.find((candidate) => candidate.key === input.packKey);
  if (!pack) throw new ValidationError("Unknown credit pack", { details: { packKey: input.packKey } });

  await getCreditService().grant({
    workspaceId: input.workspaceId,
    amount: pack.credits,
    type: "purchase",
    referenceType: REFERENCE_TYPES.purchase,
    referenceId: input.reference,
    idempotencyKey: creditKeys.purchase(input.reference),
    metadata: { packKey: pack.key, price: pack.price, currency: pack.currency, provider: "mock" },
    actorId: input.actorId,
  });

  const client = createAdminClient();
  await client.from("billing_events").insert({
    workspace_id: input.workspaceId,
    provider: "mock",
    event_type: "credits_purchased",
    external_id: input.reference,
    payload: { packKey: pack.key, credits: pack.credits, price: pack.price, currency: pack.currency },
    processed_at: new Date().toISOString(),
  });

  return { credits: pack.credits };
}

export function createMockSubscriptionProvider(): SubscriptionProvider {
  return {
    name: "mock",

    async getSubscription(workspaceId: string): Promise<Subscription | null> {
      const client = createAdminClient();
      const { data } = await client
        .from("subscriptions")
        .select("*, plans(key)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<SubscriptionRow & { plans: { key: string } | null }>();
      if (!data) return null;
      return toSubscription(data, data.plans?.key ?? "");
    },

    async changePlan({ workspaceId, planKey, actorId }): Promise<Subscription> {
      const client = createAdminClient();
      const { data: plan } = await client.from("plans").select("*").eq("key", planKey).eq("active", true).maybeSingle<PlanRow>();
      if (!plan) throw new NotFoundError("Plan not found");

      const { data: existing } = await client
        .from("subscriptions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<SubscriptionRow>();

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 86_400_000);
      const row = {
        workspace_id: workspaceId,
        plan_id: plan.id,
        status: "active" as const,
        provider: "mock",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        last_grant_period_start: now.toISOString(),
      };

      const { data: saved, error } = existing
        ? await client.from("subscriptions").update(row).eq("id", existing.id).select("*").single<SubscriptionRow>()
        : await client.from("subscriptions").insert(row).select("*").single<SubscriptionRow>();
      if (error || !saved) throw new ConflictError("Subscription could not be updated");

      await client.from("workspaces").update({ plan_id: plan.id }).eq("id", workspaceId);

      // Grant the new plan's monthly credits once for the current period.
      if (plan.monthly_credits > 0) {
        await getCreditService().grant({
          workspaceId,
          amount: plan.monthly_credits,
          type: "monthly_grant",
          referenceType: REFERENCE_TYPES.plan,
          referenceId: plan.key,
          idempotencyKey: creditKeys.monthlyGrant(workspaceId, `${formatGrantPeriod(now)}:${plan.key}`),
          metadata: { plan: plan.key, provider: "mock" },
          actorId,
        });
      }

      await client.from("billing_events").insert({
        workspace_id: workspaceId,
        provider: "mock",
        event_type: "subscription_updated",
        external_id: saved.id,
        payload: { planKey: plan.key, monthlyCredits: plan.monthly_credits },
        processed_at: new Date().toISOString(),
      });

      await recordActivity(client, { workspaceId, actorId, type: "note_added", title: `Plan changed to ${plan.name}`, metadata: { planKey: plan.key } });

      return toSubscription(saved, plan.key);
    },

    async cancel({ workspaceId, atPeriodEnd, actorId }): Promise<Subscription> {
      const client = createAdminClient();
      const { data: existing } = await client
        .from("subscriptions")
        .select("*, plans(key)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<SubscriptionRow & { plans: { key: string } | null }>();
      if (!existing) throw new NotFoundError("Subscription not found");

      const { data: saved, error } = await client
        .from("subscriptions")
        .update({ cancel_at_period_end: atPeriodEnd, status: atPeriodEnd ? existing.status : "cancelled" })
        .eq("id", existing.id)
        .select("*")
        .single<SubscriptionRow>();
      if (error || !saved) throw new ConflictError("Subscription could not be cancelled");

      await client.from("billing_events").insert({
        workspace_id: workspaceId,
        provider: "mock",
        event_type: "subscription_cancelled",
        external_id: saved.id,
        payload: { atPeriodEnd, actorId },
        processed_at: new Date().toISOString(),
      });

      return toSubscription(saved, existing.plans?.key ?? "");
    },
  };
}

function toSubscription(row: SubscriptionRow, planKey: string): Subscription {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    planId: row.plan_id,
    planKey,
    status: row.status,
    provider: row.provider,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  };
}

export { CREDIT_PACKS };
