import type { Metadata } from "next";
import { Building2, Coins, FileSearch, Radar, SquarePlus, Target } from "lucide-react";
import Link from "next/link";

import { DemoBadge, GoogleAttribution, Kpi, NotExhaustiveNotice, PageHeader, Section, StatCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DueFollowUps, type DueFollowUpItem } from "@/features/dashboard/components/due-follow-ups";
import { FirstRunGuide } from "@/features/dashboard/components/first-run-guide";
import { OpportunitiesByServiceChart } from "@/features/dashboard/components/opportunities-by-service-chart";
import { PipelineFunnel } from "@/features/dashboard/components/pipeline-funnel";
import { RecentScans, type RecentScanItem } from "@/features/dashboard/components/recent-scans";
import { ScoreDistributionChart } from "@/features/dashboard/components/score-distribution-chart";
import { getDashboardSummary } from "@/features/analytics/queries";
import { formatDate, formatDateTime, isDue } from "@/features/pipeline/components/format";
import { listDueFollowUps } from "@/features/pipeline/queries";
import { listScans } from "@/features/scans/queries";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";
import { getProviderStatus } from "@/lib/providers/registry";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "dashboard");
  return { title: t("title") };
}

export default async function DashboardPage() {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "dashboard");
  const tc = getT(ctx.locale, "common");

  const [summary, dueLeads, scans] = await Promise.all([getDashboardSummary(ctx), listDueFollowUps(ctx, 6), listScans(ctx, { limit: 5 })]);
  const providers = getProviderStatus();
  const numbers = new Intl.NumberFormat(ctx.locale === "en" ? "en-GB" : "tr-TR");
  const money = new Intl.NumberFormat(ctx.locale === "en" ? "en-GB" : "tr-TR", {
    style: "currency",
    currency: summary.pipeline.currency,
    maximumFractionDigits: 0,
  });

  const newScanButton = (
    <Button render={<Link href="/scans/new" />}>
      <SquarePlus />
      {t("newScan")}
    </Button>
  );

  const header = (
    <PageHeader
      title={t("title")}
      description={t("description")}
      actions={
        <>
          {providers.anyDemo ? <DemoBadge /> : null}
          {newScanButton}
        </>
      }
    />
  );

  if (summary.scans.total === 0) {
    return (
      <>
        {header}
        <FirstRunGuide
          title={t("firstRun.title")}
          description={t("firstRun.description")}
          action={t("firstRun.action")}
          steps={[
            { key: "discover", title: t("firstRun.steps.discover.title"), description: t("firstRun.steps.discover.description") },
            { key: "audit", title: t("firstRun.steps.audit.title"), description: t("firstRun.steps.audit.description") },
            { key: "score", title: t("firstRun.steps.score.title"), description: t("firstRun.steps.score.description") },
            { key: "outreach", title: t("firstRun.steps.outreach.title"), description: t("firstRun.steps.outreach.description") },
            { key: "pipeline", title: t("firstRun.steps.pipeline.title"), description: t("firstRun.steps.pipeline.description") },
          ]}
        />

        <Card size="sm">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi label={t("credits.available")} value={numbers.format(summary.credits.available)} />
            <Kpi label={t("credits.reserved")} value={numbers.format(summary.credits.reserved)} />
            <Kpi label={t("credits.used")} value={numbers.format(summary.credits.usedThisMonth)} />
            <Kpi label={t("credits.granted")} value={numbers.format(summary.credits.grantedThisMonth)} />
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">{t("descriptive")}</p>
      </>
    );
  }

  const followUps: DueFollowUpItem[] = dueLeads.map((lead) => ({
    leadId: lead.id,
    businessName: lead.businessName ?? t("followUps.unnamed"),
    location: [lead.district, lead.city].filter(Boolean).join(", ") || null,
    overallScore: lead.overallScore,
    dueLabel: formatDateTime(lead.next_follow_up_at, ctx.locale),
    overdue: isDue(lead.next_follow_up_at),
  }));

  const recentScans: RecentScanItem[] = scans.items.map((scan) => ({
    id: scan.id,
    name: scan.name,
    statusLabel: t(`scanStatus.${scan.status}`),
    active: scan.progress.active,
    percent: scan.progress.percent,
    businessesLabel: t("scans.businesses", { count: scan.discovered_count }),
    createdLabel: formatDate(scan.created_at, ctx.locale),
    isDemo: scan.is_demo,
  }));

  const serviceData = summary.opportunitiesByService
    .filter((entry) => entry.count > 0)
    .map((entry) => ({ label: entry.serviceLabel, count: entry.count, averageScore: entry.averageScore }));

  const scoredBusinesses = summary.scoreDistribution.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <>
      {header}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={t("kpi.discovered")}
          value={numbers.format(summary.businesses.discovered)}
          description={t("kpi.discoveredHint")}
          icon={<Building2 className="size-4" />}
        />
        <StatCard
          label={t("kpi.audited")}
          value={numbers.format(summary.businesses.audited)}
          description={t("kpi.auditedHint")}
          icon={<FileSearch className="size-4" />}
        />
        <StatCard
          label={t("kpi.highOpportunity")}
          value={numbers.format(summary.businesses.highOpportunity)}
          description={t("kpi.highOpportunityHint")}
          tone="positive"
          icon={<Target className="size-4" />}
        />
        <StatCard
          label={t("kpi.credits")}
          value={numbers.format(summary.credits.available)}
          description={t("kpi.creditsUsed", { count: numbers.format(summary.credits.usedThisMonth) })}
          icon={<Coins className="size-4" />}
          footer={t("kpi.creditsReserved", { count: numbers.format(summary.credits.reserved) })}
        />
        <StatCard
          label={t("kpi.activeScans")}
          value={numbers.format(summary.scans.active)}
          description={t("kpi.activeScansHint", { count: numbers.format(summary.scans.total) })}
          tone={summary.scans.active > 0 ? "info" : undefined}
          icon={<Radar className="size-4" />}
          footer={t("kpi.lastCompleted", { date: formatDateTime(summary.scans.lastCompletedAt, ctx.locale) ?? t("kpi.never") })}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title={t("sections.opportunitiesByService")} description={t("sections.opportunitiesByServiceHint")}>
          <Card>
            <CardContent>
              {serviceData.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{t("charts.noData")}</p>
              ) : (
                <OpportunitiesByServiceChart data={serviceData} countLabel={t("charts.businesses")} />
              )}
            </CardContent>
          </Card>
        </Section>

        <Section title={t("sections.scoreDistribution")} description={t("sections.scoreDistributionHint")}>
          <Card>
            <CardContent>
              {scoredBusinesses === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{t("charts.noData")}</p>
              ) : (
                <ScoreDistributionChart data={summary.scoreDistribution} countLabel={t("charts.businesses")} />
              )}
            </CardContent>
          </Card>
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Section
          title={t("sections.pipelineFunnel")}
          description={t("sections.pipelineFunnelHint")}
          actions={
            <Button variant="ghost" size="sm" render={<Link href="/pipeline" />}>
              {t("pipelineSummary.view")}
            </Button>
          }
        >
          <Card>
            <CardContent className="flex flex-col gap-4">
              <PipelineFunnel
                stages={summary.pipeline.byStage.map((stage) => ({ key: stage.stageKey, name: stage.stageName, count: stage.count }))}
                emptyLabel={t("pipelineSummary.empty")}
                countLabel={(count) => numbers.format(count)}
              />
              <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
                <Kpi label={t("pipelineSummary.total")} value={numbers.format(summary.pipeline.total)} />
                <Kpi label={t("pipelineSummary.open")} value={numbers.format(summary.pipeline.open)} />
                <Kpi label={t("pipelineSummary.won")} value={numbers.format(summary.pipeline.won)} tone="positive" />
                <Kpi label={t("pipelineSummary.wonValue")} value={money.format(summary.pipeline.wonValue)} />
              </div>
            </CardContent>
          </Card>
        </Section>

        <Section
          title={t("sections.dueFollowUps")}
          actions={
            <Button variant="ghost" size="sm" render={<Link href="/pipeline?due=true" />}>
              {t("viewAll")}
            </Button>
          }
        >
          <DueFollowUps
            items={followUps}
            labels={{
              empty: t("followUps.empty"),
              emptyHint: t("followUps.emptyHint"),
              overdue: t("followUps.overdue"),
              open: t("followUps.open"),
              reminder: t("followUps.reminder"),
            }}
          />
        </Section>

        <Section
          title={t("sections.recentScans")}
          actions={
            <Button variant="ghost" size="sm" render={<Link href="/scans" />}>
              {t("viewAll")}
            </Button>
          }
        >
          <RecentScans items={recentScans} labels={{ empty: t("scans.empty"), open: t("scans.open"), demo: tc("demo.badge") }} />
        </Section>
      </div>

      <Section title={t("sections.outreach")} description={t("outreach.hint")}>
        <Card size="sm">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi label={t("outreach.generated")} value={numbers.format(summary.messages.generated)} />
            <Kpi label={t("outreach.copied")} value={numbers.format(summary.messages.copied)} />
            <Kpi label={t("outreach.channelsOpened")} value={numbers.format(summary.messages.channelsOpened)} />
            <Kpi label={t("credits.used")} value={numbers.format(summary.credits.usedThisMonth)} />
          </CardContent>
        </Card>
      </Section>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">{t("descriptive")}</p>
        <NotExhaustiveNotice />
        <GoogleAttribution variant="full" />
      </div>
    </>
  );
}
