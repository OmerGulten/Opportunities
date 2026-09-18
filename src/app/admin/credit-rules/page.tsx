import type { Metadata } from "next";

import { InlineAlert, PageHeader } from "@/components/shared";
import { CreditRulesEditor, type AdminCreditRuleItem } from "@/features/admin/components/credit-rules-editor";
import { getRequestLocale, requirePlatformAdmin } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

import { isPlatformDataAvailable, listAllCreditPricingRules } from "../_data";

export const metadata: Metadata = { title: "Credit rules" };

export default async function AdminCreditRulesPage() {
  await requirePlatformAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale, "admin");

  if (!isPlatformDataAvailable()) {
    return (
      <>
        <PageHeader title={t("creditRules.title")} description={t("creditRules.description")} />
        <InlineAlert tone="neutral" title={t("common.notConfiguredTitle")}>
          {t("common.notConfigured")}
        </InlineAlert>
      </>
    );
  }

  const rules = await listAllCreditPricingRules();
  const items: AdminCreditRuleItem[] = rules.map((rule) => ({
    id: rule.id,
    key: rule.key,
    name: rule.name,
    unit: rule.unit,
    cost: rule.cost,
    active: rule.active,
  }));

  return (
    <>
      <PageHeader title={t("creditRules.title")} description={t("creditRules.description")} />
      <CreditRulesEditor items={items} />
    </>
  );
}
