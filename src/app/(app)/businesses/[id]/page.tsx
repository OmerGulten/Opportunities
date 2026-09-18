import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { z } from "zod";

import { DemoBadge, EmptyState, InlineAlert, Section } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/features/businesses/components/activity-timeline";
import { BenchmarkSection } from "@/features/businesses/components/benchmark";
import { BusinessInfo } from "@/features/businesses/components/business-info";
import { BusinessDetailHeader } from "@/features/businesses/components/detail-header";
import { GoogleAuditSection } from "@/features/businesses/components/google-audit";
import { InstagramSection } from "@/features/businesses/components/instagram-audit";
import { OpportunityAnalysis } from "@/features/businesses/components/opportunity-analysis";
import { OutreachSection } from "@/features/businesses/components/outreach";
import { PipelineCard } from "@/features/businesses/components/pipeline-card";
import { RecommendationsSection } from "@/features/businesses/components/recommendations";
import { SalesNotes } from "@/features/businesses/components/sales-notes";
import { formatDate } from "@/features/businesses/components/summaries";
import { WebsiteAuditSection } from "@/features/businesses/components/website-audit";
import { getBusinessDetail } from "@/features/businesses/queries";
import { DigitalGapBadges } from "@/features/opportunities/components/cells";
import { loadServiceOptions } from "@/features/opportunities/components/reference-data";
import { getLead } from "@/features/pipeline/queries";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";
import { getProviderStatus } from "@/lib/providers/registry";

/** Reads session cookies and workspace-scoped data on every request. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "businesses");
  return { title: t("title") };
}

const idSchema = z.uuid();

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "businesses");

  const parsedId = idSchema.safeParse(id);
  const detail = parsedId.success ? await getBusinessDetail(ctx, parsedId.data) : null;

  if (!detail) {
    return (
      <EmptyState
        icon={<Building2 />}
        title={t("detail.notFoundTitle")}
        description={t("detail.notFoundDescription")}
        action={
          <Button variant="outline" size="sm" render={<Link href="/businesses" />}>
            {t("detail.backToList")}
          </Button>
        }
      />
    );
  }

  const [services, leadDetail] = await Promise.all([
    loadServiceOptions(ctx),
    detail.lead ? getLead(ctx, detail.lead.id) : Promise.resolve(null),
  ]);
  const serviceIcons = Object.fromEntries(services.map((service) => [service.id, service.icon]));
  const providers = getProviderStatus();

  return (
    <div className="flex flex-col gap-6">
      <BusinessDetailHeader
        detail={detail}
        locale={ctx.locale}
        serviceIcons={serviceIcons}
        badge={providers.anyDemo ? <DemoBadge /> : null}
      />

      {detail.business.is_ignored ? (
        <InlineAlert tone="neutral" title={t("detail.notices.ignoredTitle")}>
          {t("detail.notices.ignored")}
        </InlineAlert>
      ) : null}

      {!detail.snapshot ? (
        <InlineAlert tone="attention" title={t("detail.notices.noSnapshotTitle")}>
          {t("detail.notices.noSnapshot")}
        </InlineAlert>
      ) : detail.snapshotStale ? (
        <InlineAlert tone="attention" title={t("detail.notices.staleTitle")}>
          {t("detail.notices.stale", { date: formatDate(detail.snapshot.fetched_at, ctx.locale) ?? "" })}
        </InlineAlert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="opportunity" title={t("detail.sections.opportunity")} description={t("detail.sections.opportunityDescription")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t("detail.opportunity.gapsObserved", { count: detail.opportunity?.digital_gaps.length ?? 0 })}
              </span>
              <DigitalGapBadges gaps={detail.opportunity?.digital_gaps ?? []} max={12} />
            </div>
            <OpportunityAnalysis services={detail.serviceScores} serviceIcons={serviceIcons} />
          </Section>

          <Section id="google" title={t("detail.sections.google")} description={t("detail.sections.googleDescription")}>
            <GoogleAuditSection detail={detail} locale={ctx.locale} />
          </Section>

          <Section id="website" title={t("detail.sections.website")} description={t("detail.sections.websiteDescription")}>
            <WebsiteAuditSection detail={detail} locale={ctx.locale} />
          </Section>

          <Section id="instagram" title={t("detail.sections.instagram")} description={t("detail.sections.instagramDescription")}>
            <InstagramSection detail={detail} locale={ctx.locale} />
          </Section>

          <Section id="benchmark" title={t("detail.sections.benchmark")} description={t("detail.sections.benchmarkDescription")}>
            <BenchmarkSection detail={detail} locale={ctx.locale} />
          </Section>

          <Section id="recommendations" title={t("detail.sections.recommendations")} description={t("detail.sections.recommendationsDescription")}>
            <RecommendationsSection detail={detail} locale={ctx.locale} serviceIcons={serviceIcons} />
          </Section>

          <Section id="outreach" title={t("detail.sections.outreach")} description={t("detail.sections.outreachDescription")}>
            <OutreachSection detail={detail} locale={ctx.locale} />
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section id="info" title={t("detail.sections.info")} description={t("detail.sections.infoDescription")}>
            <BusinessInfo detail={detail} locale={ctx.locale} />
          </Section>

          <Section id="pipeline" title={t("detail.sections.pipeline")} description={t("detail.sections.pipelineDescription")}>
            <PipelineCard detail={detail} locale={ctx.locale} />
          </Section>

          <Section id="notes" title={t("detail.sections.notes")} description={t("detail.sections.notesDescription")}>
            <SalesNotes
              businessId={detail.business.id}
              leadId={detail.lead?.id ?? null}
              notes={leadDetail?.notes ?? []}
              locale={ctx.locale}
            />
          </Section>

          <Section id="activity" title={t("detail.sections.activity")} description={t("detail.sections.activityDescription")}>
            <ActivityTimeline activities={detail.activities} locale={ctx.locale} />
          </Section>
        </div>
      </div>
    </div>
  );
}
