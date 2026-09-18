import { CreditCard } from "lucide-react";
import type { Metadata } from "next";

import { InlineAlert, PageHeader, Section } from "@/components/shared";
import { ProvidersTable, type AdminProviderItem } from "@/features/admin/components/providers-table";
import { getRequestLocale, requirePlatformAdmin } from "@/lib/auth/context";
import { isRealPaymentsEnabled } from "@/lib/billing";
import { getT } from "@/lib/i18n";
import { getProviderStatus } from "@/lib/providers/registry";

export const metadata: Metadata = { title: "Providers" };

export default async function AdminProvidersPage() {
  await requirePlatformAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale, "admin");

  const status = getProviderStatus();
  const realPayments = await isRealPaymentsEnabled();

  const items: AdminProviderItem[] = [
    { capability: "places", provider: status.places.provider, demo: status.places.demo, detail: null },
    { capability: "ai", provider: status.ai.provider, demo: status.ai.demo, detail: status.ai.model ? t("providers.model", { model: status.ai.model }) : null },
    { capability: "performance", provider: status.performance.provider, demo: status.performance.demo, detail: null },
  ];

  return (
    <>
      <PageHeader title={t("providers.title")} description={t("providers.description")} />

      {status.forced ? (
        <InlineAlert tone="attention" title={t("providers.forcedTitle")}>
          {t("providers.forcedDescription")}
        </InlineAlert>
      ) : status.anyDemo ? (
        <InlineAlert tone="attention" title={t("providers.demoTitle")}>
          {t("providers.demoDescription")}
        </InlineAlert>
      ) : (
        <InlineAlert tone="positive" title={t("providers.liveTitle")}>
          {t("providers.liveDescription")}
        </InlineAlert>
      )}

      <ProvidersTable items={items} />

      <Section title={t("providers.paymentsTitle")}>
        <InlineAlert tone={realPayments ? "positive" : "neutral"} icon={<CreditCard className="size-4" />}>
          {realPayments ? t("providers.paymentsReal") : t("providers.paymentsMock")}
        </InlineAlert>
      </Section>
    </>
  );
}
