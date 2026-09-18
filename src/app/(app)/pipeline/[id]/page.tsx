import type { Metadata } from "next";
import { Building2, SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState, GoogleAttribution, KeyValueList, PageHeader, ScoreRing, Section, ServiceBadge, WebsiteStatusBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatDateTime, isDue } from "@/features/pipeline/components/format";
import { LeadActivity, type LeadActivityItem } from "@/features/pipeline/components/lead-activity";
import { LeadDetailPanel } from "@/features/pipeline/components/lead-detail-panel";
import { LeadFollowUp } from "@/features/pipeline/components/lead-follow-up";
import { LeadNotes, type LeadNoteModel } from "@/features/pipeline/components/lead-notes";
import { getLead } from "@/features/pipeline/queries";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";
import type { WebsiteStatus } from "@/types/signals";

import { loadOwners, loadServiceLabels, loadStages, ownerIndex } from "../_data";

const WEBSITE_STATUSES: WebsiteStatus[] = ["found", "not_found", "unreachable", "redirected", "invalid", "not_checked"];

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "pipeline");
  return { title: t("title") };
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [ctx, { id }] = await Promise.all([requireWorkspaceContext(), params]);
  const t = getT(ctx.locale, "pipeline");
  const tc = getT(ctx.locale, "common");

  const lead = await getLead(ctx, id);

  if (!lead) {
    return (
      <>
        <PageHeader title={t("detail.notFound")} breadcrumbs={[{ label: t("title"), href: "/pipeline" }, { label: t("detail.notFound") }]} />
        <EmptyState
          icon={<SearchX />}
          title={t("detail.notFound")}
          description={t("detail.notFoundDescription")}
          action={<Button render={<Link href="/pipeline" />}>{t("detail.backToBoard")}</Button>}
        />
      </>
    );
  }

  const [stages, owners, serviceLabels] = await Promise.all([loadStages(ctx), loadOwners(ctx), loadServiceLabels(ctx)]);
  const ownerNames = ownerIndex(owners);
  const stageNamesByKey = new Map(stages.map((stage) => [stage.key, stage.name]));

  const service = lead.primaryServiceKey ? serviceLabels.get(lead.primaryServiceKey) : undefined;
  const businessName = lead.businessName ?? lead.business_id;
  const location = [lead.district, lead.city].filter(Boolean).join(", ");
  const websiteStatus = WEBSITE_STATUSES.find((status) => status === lead.websiteStatus) ?? "not_checked";
  const followUpLabel = formatDateTime(lead.next_follow_up_at, ctx.locale);

  const notes: LeadNoteModel[] = lead.notes.map((note) => ({
    id: note.id,
    body: note.body,
    authorName: note.author_id ? (ownerNames.get(note.author_id) ?? null) : null,
    createdLabel: formatDateTime(note.created_at, ctx.locale),
  }));

  const activity: LeadActivityItem[] = lead.activities.map((entry) => {
    const labelKey = `activity.types.${entry.type}`;
    const label = t(labelKey);
    const from = typeof entry.metadata?.from === "string" ? entry.metadata.from : null;
    const to = typeof entry.metadata?.to === "string" ? entry.metadata.to : null;

    return {
      id: entry.id,
      type: entry.type,
      label: label === labelKey ? t("activity.types.unknown") : label,
      detail:
        from || to
          ? t("activity.stageMove", {
              from: (from && stageNamesByKey.get(from)) ?? from ?? tc("states.unknown"),
              to: (to && stageNamesByKey.get(to)) ?? to ?? tc("states.unknown"),
            })
          : (entry.title ?? null),
      dateLabel: formatDateTime(entry.created_at, ctx.locale),
    };
  });

  return (
    <>
      <PageHeader
        title={businessName}
        description={location || t("detail.locationUnknown")}
        breadcrumbs={[{ label: t("title"), href: "/pipeline" }, { label: businessName }]}
        actions={
          <>
            <Button variant="outline" render={<Link href={`/businesses/${lead.business_id}`} />}>
              <Building2 />
              {t("detail.viewBusiness")}
            </Button>
            <Button variant="ghost" render={<Link href="/pipeline" />}>
              {t("detail.backToBoard")}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Section title={t("detail.overview")}>
            <Card>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                <ScoreRing score={lead.overallScore} size="lg" caption={t("detail.scoreCaption")} />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {service ? <ServiceBadge name={service.name} icon={service.icon} /> : <span className="text-sm text-muted-foreground">{t("card.noService")}</span>}
                    <WebsiteStatusBadge status={websiteStatus} />
                    <Badge variant="outline" className="font-normal">
                      {t(`status.${lead.status}`)}
                    </Badge>
                  </div>
                  {lead.overallScore === null ? <p className="text-sm text-muted-foreground">{t("detail.noScore")}</p> : null}
                  <KeyValueList
                    items={[
                      { key: "stage", label: t("detail.stage"), value: lead.stage?.name ?? tc("states.unknown") },
                      { key: "owner", label: t("detail.owner"), value: lead.owner_id ? (ownerNames.get(lead.owner_id) ?? tc("states.unknown")) : t("filters.unassigned") },
                      {
                        key: "lastContact",
                        label: t("detail.lastContact"),
                        value: formatDate(lead.last_contacted_at, ctx.locale) ?? t("card.neverContacted"),
                      },
                      { key: "created", label: t("detail.createdAt"), value: formatDateTime(lead.created_at, ctx.locale) ?? tc("states.unknown") },
                      { key: "updated", label: t("detail.updatedAt"), value: formatDateTime(lead.updated_at, ctx.locale) ?? tc("states.unknown") },
                      ...(lead.source_scan_id
                        ? [
                            {
                              key: "source",
                              label: t("detail.source"),
                              value: (
                                <Link href={`/scans/${lead.source_scan_id}`} className="text-sm text-primary hover:underline">
                                  {lead.source_scan_id.slice(0, 8)}
                                </Link>
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                  <GoogleAttribution />
                </div>
              </CardContent>
            </Card>
          </Section>

          <Section title={t("detail.stageAndOwner")} description={t("detail.estimatedValueHint")}>
            <Card>
              <CardContent>
                <LeadDetailPanel
                  leadId={lead.id}
                  stages={stages}
                  owners={owners}
                  initial={{
                    stageId: lead.stage_id,
                    ownerId: lead.owner_id,
                    estimatedValue: lead.estimated_value,
                    wonValue: lead.won_value,
                    currency: lead.currency,
                    lossReason: lead.loss_reason,
                  }}
                />
              </CardContent>
            </Card>
          </Section>

          <Section title={t("notes.title")} description={t("notes.count", { count: notes.length })}>
            <LeadNotes leadId={lead.id} notes={notes} />
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section title={t("followUp.title")}>
            <Card>
              <CardContent>
                <LeadFollowUp leadId={lead.id} currentLabel={followUpLabel} due={isDue(lead.next_follow_up_at)} />
              </CardContent>
            </Card>
          </Section>

          <Section title={t("activity.title")} description={t("activity.description")}>
            <Card>
              <CardContent>
                <LeadActivity items={activity} emptyLabel={t("activity.empty")} />
              </CardContent>
            </Card>
          </Section>
        </div>
      </div>
    </>
  );
}
