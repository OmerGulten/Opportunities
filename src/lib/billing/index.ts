import "server-only";

import { serverEnv } from "@/lib/config/env";
import { getFeatureFlags } from "@/lib/db/settings";
import { FeatureDisabledError } from "@/lib/errors";

import { createMockBillingProvider, createMockSubscriptionProvider } from "./mock";
import type { BillingProvider, SubscriptionProvider } from "./types";

export type * from "./types";
export { CREDIT_PACKS, completeMockPurchase } from "./mock";

let billingProvider: BillingProvider | null = null;
let subscriptionProvider: SubscriptionProvider | null = null;

/**
 * Provider selection. Only the mock provider exists today; a real vendor is
 * registered here once `real_payments` is enabled, without touching callers.
 */
export function getBillingProvider(): BillingProvider {
  if (billingProvider) return billingProvider;
  if (serverEnv().BILLING_PROVIDER !== "mock") {
    throw new FeatureDisabledError("real_payments");
  }
  billingProvider = createMockBillingProvider();
  return billingProvider;
}

export function getSubscriptionProvider(): SubscriptionProvider {
  if (subscriptionProvider) return subscriptionProvider;
  subscriptionProvider = createMockSubscriptionProvider();
  return subscriptionProvider;
}

/** Guards any path that would take real money while payments are flagged off. */
export async function assertPaymentsEnabled(): Promise<void> {
  const flags = await getFeatureFlags();
  if (!flags.real_payments || !serverEnv().FEATURE_REAL_PAYMENTS) {
    throw new FeatureDisabledError("real_payments");
  }
}

export async function isRealPaymentsEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.real_payments && serverEnv().FEATURE_REAL_PAYMENTS;
}

/** Test helper. */
export function resetBillingProviders(): void {
  billingProvider = null;
  subscriptionProvider = null;
}
