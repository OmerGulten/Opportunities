import type { Metadata } from "next";

import { InlineAlert, PageHeader } from "@/components/shared";
import { ServicesTable, type AdminServiceItem } from "@/features/admin/components/services-table";
import { getRequestLocale, requirePlatformAdmin } from "@/lib/auth/context";
import { localizedDescription, localizedName } from "@/lib/db/reference";
import { getT } from "@/lib/i18n";

import { isPlatformDataAvailable, listAllServiceRules, listAllServices } from "../_data";

export const metadata: Metadata = { title: "Services" };

export default async function AdminServicesPage() {
  await requirePlatformAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale, "admin");

  if (!isPlatformDataAvailable()) {
    return (
      <>
        <PageHeader title={t("services.title")} description={t("services.description")} />
        <InlineAlert tone="neutral" title={t("common.notConfiguredTitle")}>
          {t("common.notConfigured")}
        </InlineAlert>
      </>
    );
  }

  const [services, rules] = await Promise.all([listAllServices(), listAllServiceRules()]);
  const ruleCounts = new Map<string, number>();
  for (const rule of rules) ruleCounts.set(rule.service_id, (ruleCounts.get(rule.service_id) ?? 0) + 1);

  const items: AdminServiceItem[] = services.map((service) => ({
    id: service.id,
    key: service.key,
    name: localizedName(service, locale),
    description: localizedDescription(service, locale),
    icon: service.icon,
    scoreNormalizer: service.score_normalizer,
    ruleCount: ruleCounts.get(service.id) ?? 0,
    active: service.active,
  }));

  return (
    <>
      <PageHeader title={t("services.title")} description={t("services.description")} />
      <ServicesTable items={items} />
    </>
  );
}
