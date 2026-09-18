import type { Metadata } from "next";

import { InlineAlert, PageHeader } from "@/components/shared";
import { PlansTable, type AdminPlanItem } from "@/features/admin/components/plans-table";
import { getRequestLocale, requirePlatformAdmin } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

import { listAllPlans } from "../_data";

export const metadata: Metadata = { title: "Plans" };

export default async function AdminPlansPage() {
  await requirePlatformAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale, "admin");
  const plans = await listAllPlans();

  const items: AdminPlanItem[] = plans.map((plan) => ({
    id: plan.id,
    key: plan.key,
    name: plan.name,
    description: plan.description,
    monthlyCredits: plan.monthly_credits,
    priceMonthly: plan.price_monthly,
    currency: plan.currency,
    maxMembers: plan.max_members,
    isDefault: plan.is_default,
    active: plan.active,
    // Only the enabled feature *keys* leave the server; raw values stay internal.
    features: Object.entries(plan.features ?? {})
      .filter(([, value]) => value === true)
      .map(([key]) => key),
  }));

  return (
    <>
      <PageHeader title={t("plans.title")} description={t("plans.description")} />
      <InlineAlert tone="neutral" title={t("common.readOnly")}>
        {t("common.readOnlyHint")}
      </InlineAlert>
      <PlansTable items={items} />
    </>
  );
}
