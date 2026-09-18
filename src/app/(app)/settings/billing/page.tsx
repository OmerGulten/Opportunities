import type { Metadata } from "next";

import { BillingPanel, type BillingPlanOption, type BillingSubscriptionInfo } from "@/features/settings/components/billing-panel";
import { CreditLedgerTable, type CreditLedgerEntry } from "@/features/settings/components/credit-ledger-table";
import { hasRole, requireWorkspaceContext } from "@/lib/auth/context";
import { CREDIT_PACKS, isRealPaymentsEnabled } from "@/lib/billing";
import { listPlans } from "@/lib/db/reference";
import { getT } from "@/lib/i18n";
import type { CreditLedgerRow, SubscriptionRow } from "@/types/db";

const LEDGER_PAGE_SIZE = 10;

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireWorkspaceContext();
  return { title: getT(ctx.locale, "billing")("title") };
}

/**
 * Plan, credit balance and credit history.
 *
 * The reads below go through the RLS-scoped client, so a workspace only ever
 * sees its own subscription, account and ledger rows. Later ledger pages are
 * fetched by the table from /api/credits/ledger.
 */
export default async function BillingSettingsPage() {
  const ctx = await requireWorkspaceContext();
  const canManage = hasRole(ctx.role, "admin");
  const workspaceId = ctx.workspace.id;

  const monthStart = startOfUtcMonth().toISOString();

  const [plans, realPayments, subscription, account, ledger, monthConsumption] = await Promise.all([
    listPlans(ctx.supabase),
    isRealPaymentsEnabled(),
    ctx.supabase
      .from("subscriptions")
      .select("*, plans(key)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SubscriptionRow & { plans: { key: string } | null }>(),
    ctx.supabase
      .from("credit_accounts")
      .select("balance, reserved, lifetime_granted, lifetime_consumed")
      .eq("workspace_id", workspaceId)
      .maybeSingle<{ balance: number; reserved: number; lifetime_granted: number; lifetime_consumed: number }>(),
    ctx.supabase
      .from("credit_ledger")
      .select("id, type, amount, balance_after, reference_type, created_at", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .range(0, LEDGER_PAGE_SIZE - 1)
      .returns<Array<Pick<CreditLedgerRow, "id" | "type" | "amount" | "balance_after" | "reference_type" | "created_at">>>(),
    ctx.supabase
      .from("credit_ledger")
      .select("amount")
      .eq("workspace_id", workspaceId)
      .eq("type", "consumption")
      .gte("created_at", monthStart)
      .returns<Array<{ amount: number }>>(),
  ]);

  const currentPlanId = subscription.data?.plan_id ?? ctx.workspace.plan_id;
  const currentPlan = plans.find((plan) => plan.id === currentPlanId) ?? null;

  const planOptions: BillingPlanOption[] = plans.map((plan) => ({
    id: plan.id,
    key: plan.key,
    name: plan.name,
    description: plan.description,
    monthlyCredits: plan.monthly_credits,
    priceMonthly: plan.price_monthly,
    currency: plan.currency,
    maxMembers: plan.max_members,
    isCurrent: plan.id === currentPlanId,
  }));

  const subscriptionInfo: BillingSubscriptionInfo | null = subscription.data
    ? {
        planKey: subscription.data.plans?.key ?? currentPlan?.key ?? "",
        status: subscription.data.status,
        currentPeriodStart: subscription.data.current_period_start,
        currentPeriodEnd: subscription.data.current_period_end,
        cancelAtPeriodEnd: subscription.data.cancel_at_period_end,
      }
    : null;

  const entries: CreditLedgerEntry[] = (ledger.data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    amount: row.amount,
    balanceAfter: row.balance_after,
    referenceType: row.reference_type,
    createdAt: row.created_at,
  }));

  const usedThisMonth = (monthConsumption.data ?? []).reduce((sum, row) => sum + Math.abs(row.amount), 0);

  return (
    <div className="flex flex-col gap-6">
      <BillingPanel
        plans={planOptions}
        subscription={subscriptionInfo}
        packs={CREDIT_PACKS.map((pack) => ({ key: pack.key, credits: pack.credits, price: pack.price, currency: pack.currency }))}
        credits={{
          available: account.data?.balance ?? 0,
          reserved: account.data?.reserved ?? 0,
          usedThisMonth,
          includedMonthly: currentPlan?.monthly_credits ?? 0,
          lifetimeGranted: account.data?.lifetime_granted ?? 0,
          lifetimeConsumed: account.data?.lifetime_consumed ?? 0,
        }}
        realPayments={realPayments}
        canManage={canManage}
      />
      <CreditLedgerTable initialItems={entries} initialTotal={ledger.count ?? entries.length} pageSize={LEDGER_PAGE_SIZE} />
    </div>
  );
}

function startOfUtcMonth(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
