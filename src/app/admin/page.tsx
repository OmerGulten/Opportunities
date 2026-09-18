import {
  Building2,
  Bot,
  CircleAlert,
  Coins,
  Database,
  Plug,
  Radar,
  RotateCcw,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Metadata } from "next";

import { InlineAlert, PageHeader, Section, StatCard } from "@/components/shared";
import { getPlatformUsage } from "@/features/admin/service";
import { requirePlatformAdmin, getRequestLocale } from "@/lib/auth/context";
import { dateLocaleTag, getT } from "@/lib/i18n";

import { isPlatformDataAvailable } from "./_data";

export const metadata: Metadata = { title: "Overview" };

const PERIOD_DAYS = 30;

export default async function AdminOverviewPage() {
  await requirePlatformAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale, "admin");
  const tag = dateLocaleTag[locale];
  const number = (value: number) => new Intl.NumberFormat(tag).format(value);
  const money = (value: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

  if (!isPlatformDataAvailable()) {
    return (
      <>
        <PageHeader title={t("overview.title")} description={t("overview.description", { days: PERIOD_DAYS })} />
        <InlineAlert tone="neutral" title={t("common.notConfiguredTitle")}>
          {t("common.notConfigured")}
        </InlineAlert>
      </>
    );
  }

  const ctx = await requirePlatformAdmin();
  const usage = await getPlatformUsage(ctx, PERIOD_DAYS);

  return (
    <>
      <PageHeader title={t("overview.title")} description={t("overview.description", { days: PERIOD_DAYS })} />

      <Section title={t("overview.groups.tenants")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t("overview.metrics.workspaces")} value={number(usage.workspaces)} icon={<Building2 />} description={t("overview.allTime")} />
          <StatCard label={t("overview.metrics.users")} value={number(usage.users)} icon={<Users />} description={t("overview.allTime")} />
          <StatCard label={t("overview.metrics.businesses")} value={number(usage.businesses)} icon={<Database />} description={t("overview.allTime")} />
          <StatCard label={t("overview.metrics.opportunities")} value={number(usage.opportunities)} icon={<Target />} description={t("overview.allTime")} />
        </div>
      </Section>

      <Section title={t("overview.groups.pipeline")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t("overview.metrics.scans")} value={number(usage.scans.total)} icon={<Radar />} description={t("overview.allTime")} />
          <StatCard
            label={t("overview.metrics.scansActive")}
            value={number(usage.scans.active)}
            icon={<RotateCcw />}
            tone={usage.scans.active > 0 ? "info" : undefined}
          />
          <StatCard
            label={t("overview.metrics.scansFailed")}
            value={number(usage.scans.failed)}
            icon={<CircleAlert />}
            tone={usage.scans.failed > 0 ? "negative" : undefined}
          />
          <StatCard
            label={t("overview.metrics.aiGenerations")}
            value={number(usage.aiGenerations.total)}
            icon={<Bot />}
            description={t("overview.periodLabel", { days: PERIOD_DAYS })}
            footer={`${t("overview.metrics.aiFailed")}: ${number(usage.aiGenerations.failed)}`}
          />
        </div>
      </Section>

      <Section title={t("overview.groups.external")} description={t("overview.periodLabel", { days: PERIOD_DAYS })}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t("overview.metrics.providerCalls")} value={number(usage.providerCalls.total)} icon={<Plug />} />
          <StatCard
            label={t("overview.metrics.providerCallsFailed")}
            value={number(usage.providerCalls.failed)}
            icon={<CircleAlert />}
            tone={usage.providerCalls.failed > 0 ? "attention" : undefined}
          />
          <StatCard
            label={t("overview.metrics.estimatedCost")}
            value={money(usage.providerCalls.estimatedCost)}
            icon={<Coins />}
            description={t("overview.periodLabel", { days: PERIOD_DAYS })}
          />
        </div>
        <InlineAlert tone="neutral" icon={null}>
          {t("overview.costNotice")}
        </InlineAlert>
      </Section>

      <Section title={t("overview.groups.credits")} description={t("overview.periodLabel", { days: PERIOD_DAYS })}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t("overview.metrics.creditsGranted")} value={number(usage.credits.granted)} icon={<TrendingUp />} tone="positive" />
          <StatCard label={t("overview.metrics.creditsConsumed")} value={number(usage.credits.consumed)} icon={<TrendingDown />} />
          <StatCard label={t("overview.metrics.creditsRefunded")} value={number(usage.credits.refunded)} icon={<RotateCcw />} tone="info" />
        </div>
      </Section>
    </>
  );
}
