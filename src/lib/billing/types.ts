/**
 * Billing abstraction.
 *
 * The MVP ships a mock provider: real payment processing is a feature flag away,
 * and no payment vendor is wired into business logic. Everything the app needs
 * from billing is expressed here, so adding a provider (iyzico, Stripe, …) means
 * implementing these interfaces and registering them — no changes to plans,
 * credits or the UI.
 */

export interface BillingPlan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthlyCredits: number;
  priceMonthly: number;
  currency: string;
  maxMembers: number;
  features: Record<string, unknown>;
  isDefault: boolean;
  sortOrder: number;
}

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";

export interface Subscription {
  id: string;
  workspaceId: string;
  planId: string;
  planKey: string;
  status: SubscriptionStatus;
  provider: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface CheckoutSession {
  /** Where the user continues. The mock provider returns an internal URL. */
  url: string;
  reference: string;
  provider: string;
  /** True when no real payment will be taken. */
  isMock: boolean;
}

export interface CreditPack {
  key: string;
  credits: number;
  price: number;
  currency: string;
}

export interface StartCheckoutInput {
  workspaceId: string;
  planKey?: string;
  packKey?: string;
  returnUrl: string;
  actorId: string;
}

export interface BillingProvider {
  readonly name: string;
  readonly isMock: boolean;
  /** Packs available for one-off credit top-ups. */
  listCreditPacks(): Promise<CreditPack[]>;
  startCheckout(input: StartCheckoutInput): Promise<CheckoutSession>;
  /** Verifies and normalises a provider webhook. Mock accepts only internal calls. */
  parseWebhook(payload: unknown, signature: string | null): Promise<BillingEvent | null>;
}

export interface SubscriptionProvider {
  readonly name: string;
  getSubscription(workspaceId: string): Promise<Subscription | null>;
  changePlan(input: { workspaceId: string; planKey: string; actorId: string }): Promise<Subscription>;
  cancel(input: { workspaceId: string; atPeriodEnd: boolean; actorId: string }): Promise<Subscription>;
}

export type BillingEventType = "checkout_completed" | "subscription_updated" | "subscription_cancelled" | "payment_failed" | "credits_purchased";

export interface BillingEvent {
  type: BillingEventType;
  workspaceId: string;
  externalId: string | null;
  planKey?: string;
  credits?: number;
  amount?: number;
  currency?: string;
  payload: Record<string, unknown>;
}
