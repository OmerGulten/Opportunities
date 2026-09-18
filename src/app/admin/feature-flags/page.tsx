import type { Metadata } from "next";

import { InlineAlert, PageHeader } from "@/components/shared";
import { FeatureFlagsForm } from "@/features/admin/components/feature-flags-form";
import { getRequestLocale, requirePlatformAdmin } from "@/lib/auth/context";
import { getFeatureFlags } from "@/lib/db/settings";
import { getT } from "@/lib/i18n";

import { isPlatformDataAvailable } from "../_data";

export const metadata: Metadata = { title: "Feature flags" };

export default async function AdminFeatureFlagsPage() {
  await requirePlatformAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale, "admin");

  if (!isPlatformDataAvailable()) {
    return (
      <>
        <PageHeader title={t("flags.title")} description={t("flags.description")} />
        <InlineAlert tone="neutral" title={t("common.notConfiguredTitle")}>
          {t("common.notConfigured")}
        </InlineAlert>
      </>
    );
  }

  const flags: Record<string, boolean> = { ...(await getFeatureFlags()) };

  return (
    <>
      <PageHeader title={t("flags.title")} description={t("flags.description")} />
      <InlineAlert tone="attention">{t("scopeNotice")}</InlineAlert>
      <FeatureFlagsForm flags={flags} />
    </>
  );
}
