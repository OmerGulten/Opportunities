"use client";

import { cn } from "cn";
import { Check, Coins, CreditCard, Plus, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog, InlineAlert, StatCard } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { buyCreditPack, cancelSubscription, changePlan } from "@/features/settings/actions";
import { useFormatters, useT } from "@/lib/i18n/client";

export interface BillingPlanOption {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthlyCredits: number;
  priceMonthly: number;
  currency: string;
  maxMembers: number;
  isCurrent: boolean;
}

export interface BillingSubscriptionInfo {
  planKey: string;
  status: "trialing" | "active" | "past_due" | "cancelled";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface CreditPackOption {
  key: string;
  credits: number;
  price: number;
  currency: string;
}

export interface CreditSummary {
  available: number;
  reserved: number;
  usedThisMonth: number;
  includedMonthly: number;
  lifetimeGranted: number;
  lifetimeConsumed: number;
}

export interface BillingPanelProps {
  plans: BillingPlanOption[];
  subscription: BillingSubscriptionInfo | null;
  credits: CreditSummary;
  packs: CreditPackOption[];
  /** False while the mock provider is in use — the page says so plainly. */
  realPayments: boolean;
  canManage: boolean;
}

/**
 * Plan, credit balance and top-ups.
 *
 * While real payments are off, every action here is applied by the mock
 * provider: nothing is charged, and the notice at the top says exactly that.
 */
export function BillingPanel({ plans, subscription, credits, packs, realPayments, canManage }: BillingPanelProps) {
  const t = useT("billing");
  const { number, currency: formatCurrency, date } = useFormatters();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const currentPlan = plans.find((plan) => plan.isCurrent) ?? null;

  function selectPlan(planKey: string) {
    setBusyKey(planKey);
    startTransition(async () => {
      const result = await changePlan({ planKey });
      setBusyKey(null);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("plan.changed"));
      router.refresh();
    });
  }

  function purchase(packKey: string) {
    setBusyKey(packKey);
    startTransition(async () => {
      const result = await buyCreditPack({ packKey });
      setBusyKey(null);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("packs.purchased", { count: number(result.data.credits) }));
      router.refresh();
    });
  }

  async function cancel() {
    const result = await cancelSubscription({ atPeriodEnd: true });
    if (!result.ok) {
      toast.error(result.error.message);
      throw new Error(result.error.code);
    }
    toast.success(t("cancel.cancelled"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {realPayments ? null : (
        <InlineAlert
          tone="attention"
          title={
            <span className="flex flex-wrap items-center gap-2">
              {t("mock.title")}
              <Badge variant="outline" className="border-amber-600/25 bg-amber-500/14 font-normal text-amber-700 dark:border-amber-400/25 dark:text-amber-300">
                {t("mock.badge")}
              </Badge>
            </span>
          }
        >
          {t("mock.body")}
        </InlineAlert>
      )}

      {canManage ? null : <InlineAlert tone="neutral">{t("adminOnly")}</InlineAlert>}

      <Card>
        <CardHeader>
          <CardTitle>{t("credits.title")}</CardTitle>
          <CardDescription>{t("credits.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t("credits.included")} value={number(credits.includedMonthly)} icon={<Coins className="size-4" />} />
            <StatCard label={t("credits.used")} value={number(credits.usedThisMonth)} icon={<CreditCard className="size-4" />} />
            <StatCard
              label={t("credits.remaining")}
              value={number(credits.available)}
              icon={<Wallet className="size-4" />}
              tone={credits.available > 0 ? "positive" : "attention"}
            />
            <StatCard label={t("credits.reserved")} value={number(credits.reserved)} description={t("credits.reservedHint")} icon={<Coins className="size-4" />} />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("credits.lifetimeGranted")}: {number(credits.lifetimeGranted)} · {t("credits.lifetimeConsumed")}: {number(credits.lifetimeConsumed)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("plan.title")}</CardTitle>
          <CardDescription>{t("plan.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">
            <span className="text-muted-foreground">{t("plan.current")}: </span>
            <span className="font-medium">{currentPlan ? currentPlan.name : t("plan.none")}</span>
          </p>

          {subscription ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="font-normal">
                {t(`plan.status.${subscription.status}`)}
              </Badge>
              <span className="text-muted-foreground tabular-nums">
                {t("plan.period")}: {t("plan.periodRange", { from: date(subscription.currentPeriodStart), to: date(subscription.currentPeriodEnd) })}
              </span>
              {subscription.cancelAtPeriodEnd ? (
                <span className="text-amber-700 dark:text-amber-300">{t("plan.cancelAtPeriodEnd", { date: date(subscription.currentPeriodEnd) })}</span>
              ) : (
                <span className="text-muted-foreground">{t("plan.renews", { date: date(subscription.currentPeriodEnd) })}</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("plan.noSubscription")}</p>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} size="sm" className={cn(plan.isCurrent && "ring-2 ring-primary/40")}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    {plan.name}
                    {plan.isCurrent ? (
                      <Badge variant="outline" className="border-primary/30 font-normal text-primary">
                        {t("plan.currentBadge")}
                      </Badge>
                    ) : null}
                  </CardTitle>
                  {plan.description ? <CardDescription>{plan.description}</CardDescription> : null}
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm">
                  <p className="font-heading text-lg font-semibold tabular-nums">
                    {plan.priceMonthly > 0 ? t("plan.price", { price: formatCurrency(plan.priceMonthly, plan.currency) }) : t("plan.free")}
                  </p>
                  <p className="text-muted-foreground tabular-nums">{t("plan.monthlyCredits", { count: number(plan.monthlyCredits) })}</p>
                  <p className="text-muted-foreground">
                    {plan.maxMembers > 0 ? t("plan.members", { count: number(plan.maxMembers) }) : t("plan.unlimitedMembers")}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button
                    variant={plan.isCurrent ? "outline" : "default"}
                    size="sm"
                    className="w-full"
                    disabled={!canManage || plan.isCurrent || pending}
                    onClick={() => selectPlan(plan.key)}
                  >
                    {busyKey === plan.key && pending ? <Spinner /> : plan.isCurrent ? <Check /> : null}
                    {busyKey === plan.key && pending ? t("plan.changing") : plan.isCurrent ? t("plan.currentBadge") : t("plan.select")}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("plan.changeNote")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("packs.title")}</CardTitle>
          <CardDescription>{t("packs.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-4 md:grid-cols-3">
            {packs.map((pack) => (
              <Card key={pack.key} size="sm">
                <CardContent className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-base font-semibold tabular-nums">{t("packs.credits", { count: number(pack.credits) })}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">{formatCurrency(pack.price, pack.currency)}</p>
                  </div>
                  <Button variant="outline" size="sm" disabled={!canManage || pending} onClick={() => purchase(pack.key)}>
                    {busyKey === pack.key && pending ? <Spinner /> : <Plus />}
                    {busyKey === pack.key && pending ? t("packs.buying") : t("packs.buy")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          {realPayments ? null : <p className="text-xs text-muted-foreground">{t("packs.mockNote")}</p>}
        </CardContent>
      </Card>

      {subscription && canManage && !subscription.cancelAtPeriodEnd && subscription.status !== "cancelled" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("cancel.title")}</CardTitle>
            <CardDescription>{t("cancel.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmDialog
              title={t("cancel.dialogTitle")}
              description={t("cancel.dialogDescription", { date: date(subscription.currentPeriodEnd) })}
              confirmLabel={t("cancel.button")}
              destructive
              onConfirm={cancel}
              trigger={<Button variant="outline">{t("cancel.button")}</Button>}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
