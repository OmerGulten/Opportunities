import {
  Activity,
  BadgeCheck,
  Ban,
  CalendarRange,
  ChartColumn,
  CircleAlert,
  CircleCheck,
  Coins,
  Copy,
  ExternalLink,
  FileSignature,
  Handshake,
  Radar,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Metadata } from "next";

import { DemoBadge, EmptyState, GoogleAttribution, InlineAlert, NotExhaustiveNotice, PageHeader, Section, StatCard } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalytics } from "@/features/analytics/queries";
import {
  AnalyticsFilters,
  type AnalyticsFilterOption,
} from "@/features/analytics/components/analytics-filters";
import {
  CreditUsageChart,
  DiscoveryFunnelChart,
  GapBreakdownChart,
  ScoreDistributionChart,
  ServiceOpportunityChart,
} from "@/features/analytics/components/analytics-charts";
import { firstParam, optionalId, resolveAnalyticsRange } from "@/features/analytics/components/range";
import { listScans } from "@/features/scans/queries";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { listCategories, listServices, localizedName } from "@/lib/db/reference";
import { dateLocaleTag, getT } from "@/lib/i18n";
import { getProviderStatus } from "@/lib/providers/registry";
import { DIGITAL_GAP_ORDER } from "@/lib/scoring/gaps";
import type { Locale } from "@/types/common";

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "analytics");
  return { title: t("title"), description: t("description") };
}

/**
 * Descriptive analytics for the workspace.
 *
 * Everything on this page is a count of observed records or of user activity in
 * the selected range. There is no forecast, no projected revenue and no
 * purchase-likelihood figure anywhere, by design.
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "analytics");
  const params = await searchParams;

  const range = resolveAnalyticsRange({
    preset: firstParam(params.range),
    from: firstParam(params.from),
    to: firstParam(params.to),
  });
  const scanId = optionalId(params.scan);
  const serviceId = optionalId(params.service);
  const categoryId = optionalId(params.category);

  const [analytics, scans, services, categories] = await Promise.all([
    getAnalytics(ctx, { from: range.fromIso, to: range.toIso, scanId, serviceId, categoryId }),
    listScans(ctx, { limit: 50 }),
    listServices(ctx.supabase),
    listCategories(ctx.supabase),
  ]);

  const provider = getProviderStatus();
  const format = createFormatters(ctx.locale, analytics.pipeline.currency);

  const scanOptions: AnalyticsFilterOption[] = scans.items.map((scan) => ({ value: scan.id, label: scan.name }));
  const serviceOptions: AnalyticsFilterOption[] = services.map((service) => ({
    value: service.id,
    label: localizedName(service, ctx.locale),
  }));
  const categoryOptions: AnalyticsFilterOption[] = categories.map((category) => ({
    value: category.id,
    label: localizedName(category, ctx.locale),
  }));

  const funnelData = [
    { key: "discovered", label: t("discovery.discovered"), value: analytics.discovery.discovered },
    { key: "audited", label: t("discovery.audited"), value: analytics.discovery.audited },
    { key: "scored", label: t("discovery.scored"), value: analytics.discovery.scored },
    { key: "failed", label: t("discovery.failed"), value: analytics.discovery.failed },
  ];

  const serviceData = analytics.opportunities.byService.map((entry) => ({
    key: entry.serviceId,
    label: entry.serviceLabel,
    count: entry.count,
    averageScore: entry.averageScore,
  }));

  // "Nothing here" is stated once, rather than repeating a zero in every card.
  const isEmptyRange =
    analytics.scans.started === 0 &&
    analytics.discovery.discovered === 0 &&
    analytics.opportunities.total === 0 &&
    analytics.outreach.generated === 0 &&
    analytics.pipeline.added === 0 &&
    analytics.credits.consumed === 0;

  const knownGaps = new Set<string>(DIGITAL_GAP_ORDER);
  const gapData = analytics.gaps.byGap
    .slice(0, 8)
    .map((entry) => ({
      key: entry.gap,
      // A gap key the scoring engine does not know is shown verbatim rather than
      // guessed at, so the chart never invents a label.
      label: knownGaps.has(entry.gap) ? t(`gaps.labels.${entry.gap}`) : entry.gap,
      count: entry.count,
    }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={provider.anyDemo ? <DemoBadge /> : null}
      >
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarRange className="size-3.5" aria-hidden />
            <span className="tabular-nums">{t("range.summary", { from: format.date(range.fromIso), to: format.date(range.toIso) })}</span>
          </span>
          <span className="text-xs">{t("range.basedOn")}</span>
        </p>
      </PageHeader>

      <InlineAlert tone="neutral" title={t("disclosure.title")}>
        {t("disclosure.body")}
      </InlineAlert>

      <section aria-label={t("filters.title")}>
        <AnalyticsFilters scans={scanOptions} services={serviceOptions} categories={categoryOptions} />
      </section>

      {isEmptyRange ? <EmptyState icon={<ChartColumn />} title={t("empty.title")} description={t("empty.description")} /> : null}

      <Section title={t("sections.scans.title")} description={t("sections.scans.description")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label={t("scans.started")} value={format.number(analytics.scans.started)} icon={<Radar className="size-4" />} />
          <StatCard
            label={t("scans.completed")}
            value={format.number(analytics.scans.completed)}
            icon={<CircleCheck className="size-4" />}
            tone={analytics.scans.completed > 0 ? "positive" : undefined}
          />
          <StatCard
            label={t("scans.failed")}
            value={format.number(analytics.scans.failed)}
            icon={<CircleAlert className="size-4" />}
            tone={analytics.scans.failed > 0 ? "negative" : undefined}
          />
          <StatCard label={t("scans.cancelled")} value={format.number(analytics.scans.cancelled)} icon={<Ban className="size-4" />} />
          <StatCard
            label={t("scans.perScan")}
            value={analytics.scans.businessesPerScan === null ? "—" : format.number(analytics.scans.businessesPerScan)}
            description={t("scans.perScanHint")}
            icon={<Activity className="size-4" />}
          />
        </div>
        {analytics.scans.started === 0 ? <p className="text-sm text-muted-foreground">{t("scans.empty")}</p> : null}
      </Section>

      <Section title={t("sections.discovery.title")} description={t("sections.discovery.description")}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label={t("discovery.discovered")} value={format.number(analytics.discovery.discovered)} icon={<Search className="size-4" />} />
            <StatCard label={t("discovery.audited")} value={format.number(analytics.discovery.audited)} icon={<BadgeCheck className="size-4" />} />
            <StatCard label={t("discovery.scored")} value={format.number(analytics.discovery.scored)} icon={<Target className="size-4" />} />
            <StatCard
              label={t("discovery.failed")}
              value={format.number(analytics.discovery.failed)}
              icon={<CircleAlert className="size-4" />}
              tone={analytics.discovery.failed > 0 ? "attention" : undefined}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t("discovery.chartTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <DiscoveryFunnelChart data={funnelData} />
              <NotExhaustiveNotice />
              <GoogleAttribution />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title={t("sections.opportunities.title")} description={t("sections.opportunities.description")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t("opportunities.total")} value={format.number(analytics.opportunities.total)} icon={<Target className="size-4" />} />
          <StatCard
            label={t("opportunities.averageScore")}
            value={analytics.opportunities.averageScore === null ? t("opportunities.notScored") : format.number(analytics.opportunities.averageScore)}
            icon={<TrendingUp className="size-4" />}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("opportunities.byServiceTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ServiceOpportunityChart data={serviceData} />
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {serviceData
                  .filter((entry) => entry.count > 0 && entry.averageScore !== null)
                  .map((entry) => (
                    <li key={entry.key} className="flex items-center justify-between gap-3">
                      <span className="truncate">{entry.label}</span>
                      <span className="tabular-nums">{t("opportunities.averageServiceScore", { score: format.number(entry.averageScore ?? 0) })}</span>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("opportunities.distributionTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreDistributionChart data={analytics.opportunities.scoreDistribution.map((bucket) => ({ bucket: bucket.bucket, min: bucket.min, count: bucket.count }))} />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title={t("sections.gaps.title")} description={t("sections.gaps.description")}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard label={t("gaps.website")} value={format.number(analytics.gaps.website)} icon={<ExternalLink className="size-4" />} />
            <StatCard label={t("gaps.social")} value={format.number(analytics.gaps.social)} icon={<Sparkles className="size-4" />} />
            <StatCard label={t("gaps.google")} value={format.number(analytics.gaps.google)} icon={<Radar className="size-4" />} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t("gaps.byGapTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <GapBreakdownChart data={gapData} />
              <p className="text-xs text-muted-foreground">{t("gaps.note")}</p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title={t("sections.outreach.title")} description={t("sections.outreach.description")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t("outreach.generated")} value={format.number(analytics.outreach.generated)} icon={<FileSignature className="size-4" />} />
          <StatCard label={t("outreach.copied")} value={format.number(analytics.outreach.copied)} icon={<Copy className="size-4" />} />
          <StatCard label={t("outreach.channelsOpened")} value={format.number(analytics.outreach.channelsOpened)} icon={<ExternalLink className="size-4" />} />
          <StatCard label={t("outreach.contacted")} value={format.number(analytics.outreach.contacted)} icon={<Users className="size-4" />} />
        </div>
        <p className="text-xs text-muted-foreground">{t("outreach.note")}</p>
      </Section>

      <Section title={t("sections.pipeline.title")} description={t("sections.pipeline.description")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label={t("pipeline.added")} value={format.number(analytics.pipeline.added)} icon={<Users className="size-4" />} />
          <StatCard label={t("pipeline.meetings")} value={format.number(analytics.pipeline.meetings)} icon={<Handshake className="size-4" />} />
          <StatCard label={t("pipeline.proposals")} value={format.number(analytics.pipeline.proposals)} icon={<FileSignature className="size-4" />} />
          <StatCard
            label={t("pipeline.won")}
            value={format.number(analytics.pipeline.won)}
            icon={<CircleCheck className="size-4" />}
            tone={analytics.pipeline.won > 0 ? "positive" : undefined}
          />
          <StatCard label={t("pipeline.lost")} value={format.number(analytics.pipeline.lost)} icon={<Ban className="size-4" />} />
          <StatCard label={t("pipeline.wonValue")} value={format.currency(analytics.pipeline.wonValue)} icon={<Coins className="size-4" />} />
        </div>
        <p className="text-xs text-muted-foreground">{t("pipeline.note")}</p>
      </Section>

      <Section title={t("sections.credits.title")} description={t("sections.credits.description")}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard label={t("credits.consumed")} value={format.number(analytics.credits.consumed)} icon={<Coins className="size-4" />} />
            <StatCard label={t("credits.granted")} value={format.number(analytics.credits.granted)} icon={<Sparkles className="size-4" />} />
            <StatCard label={t("credits.refunded")} value={format.number(analytics.credits.refunded)} icon={<Activity className="size-4" />} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t("credits.byDayTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CreditUsageChart data={analytics.credits.byDay} />
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  );
}

/** Server-side formatters bound to the request locale. */
function createFormatters(locale: Locale, currency: string) {
  const tag = dateLocaleTag[locale];
  const number = new Intl.NumberFormat(tag);
  const money = new Intl.NumberFormat(tag, { style: "currency", currency, maximumFractionDigits: 0 });
  const date = new Intl.DateTimeFormat(tag, { dateStyle: "medium" });
  return {
    number: (value: number) => number.format(value),
    currency: (value: number) => money.format(value),
    date: (value: string) => date.format(new Date(value)),
  };
}
