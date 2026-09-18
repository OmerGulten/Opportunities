import type { Metadata } from "next";

import { InlineAlert, PageHeader } from "@/components/shared";
import { ScoringRulesEditor, type AdminScoringRuleGroup } from "@/features/admin/components/scoring-rules-editor";
import { getRequestLocale, requirePlatformAdmin } from "@/lib/auth/context";
import { localizedName } from "@/lib/db/reference";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/types/common";
import type { ServiceRuleRow } from "@/types/db";

import { isPlatformDataAvailable, listAllServiceRules, listAllServices } from "../_data";

export const metadata: Metadata = { title: "Scoring rules" };

interface PageSearchParams {
  service?: string | string[];
}

function ruleExplanation(rule: ServiceRuleRow, locale: Locale): string | null {
  const value = locale === "en" ? rule.explanation_en : rule.explanation_tr;
  return value && value.trim() !== "" ? value : null;
}

export default async function AdminScoringRulesPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  await requirePlatformAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale, "admin");

  if (!isPlatformDataAvailable()) {
    return (
      <>
        <PageHeader title={t("scoringRules.title")} description={t("scoringRules.description")} />
        <InlineAlert tone="neutral" title={t("common.notConfiguredTitle")}>
          {t("common.notConfigured")}
        </InlineAlert>
      </>
    );
  }

  const params = await searchParams;
  const rawService = Array.isArray(params.service) ? params.service[0] : params.service;
  const [services, rules] = await Promise.all([listAllServices(), listAllServiceRules()]);

  // An unknown id in the URL falls back to "all" rather than rendering nothing.
  const selectedServiceId = rawService && services.some((service) => service.id === rawService) ? rawService : "";

  const groups: AdminScoringRuleGroup[] = services
    .filter((service) => selectedServiceId === "" || service.id === selectedServiceId)
    .map((service) => ({
      serviceId: service.id,
      serviceKey: service.key,
      serviceName: localizedName(service, locale),
      serviceIcon: service.icon,
      serviceActive: service.active,
      rules: rules
        .filter((rule) => rule.service_id === service.id)
        .map((rule) => ({
          id: rule.id,
          key: rule.key,
          name: localizedName(rule, locale),
          explanation: ruleExplanation(rule, locale),
          signalType: rule.signal_type,
          operator: rule.operator,
          points: rule.points,
          minConfidence: rule.min_confidence,
          requiresDepth: rule.requires_depth,
          active: rule.active,
          version: rule.version,
        })),
    }))
    .filter((group) => group.rules.length > 0);

  return (
    <>
      <PageHeader title={t("scoringRules.title")} description={t("scoringRules.description")} />
      <ScoringRulesEditor
        groups={groups}
        services={services.map((service) => ({ id: service.id, name: localizedName(service, locale) }))}
        selectedServiceId={selectedServiceId}
      />
    </>
  );
}
