import type { Metadata } from "next";
import { Target } from "lucide-react";
import Link from "next/link";

import { GoogleAttribution, Kpi, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, isDue } from "@/features/pipeline/components/format";
import { PipelineBoard } from "@/features/pipeline/components/pipeline-board";
import { PipelineToolbar } from "@/features/pipeline/components/pipeline-toolbar";
import type { PipelineLeadModel, PipelineStageModel } from "@/features/pipeline/components/types";
import { getPipelineBoard } from "@/features/pipeline/queries";
import type { ListLeadsQuery } from "@/features/pipeline/schemas";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";
import type { LeadStatus } from "@/types/common";

import { loadOwners, loadServiceLabels, ownerIndex } from "./_data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: LeadStatus[] = ["open", "won", "lost", "archived"];

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "pipeline");
  return { title: t("title") };
}

export default async function PipelinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [ctx, params] = await Promise.all([requireWorkspaceContext(), searchParams]);
  const t = getT(ctx.locale, "pipeline");

  const q = single(params.q)?.trim() ?? "";
  const ownerParam = single(params.owner) ?? "all";
  const statusParam = single(params.status);
  const dueOnly = single(params.due) === "true";
  const status = STATUSES.find((value) => value === statusParam);

  const query: Partial<ListLeadsQuery> = {
    limit: 200,
    dueOnly,
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(UUID.test(ownerParam) ? { ownerId: ownerParam } : {}),
  };

  const [board, owners, serviceLabels] = await Promise.all([getPipelineBoard(ctx, query), loadOwners(ctx), loadServiceLabels(ctx)]);
  const ownerNames = ownerIndex(owners);

  const stages: PipelineStageModel[] = board.columns.map((column) => ({
    id: column.stage.id,
    key: column.stage.key,
    name: column.stage.name,
    color: column.stage.color,
    sortOrder: column.stage.sort_order,
    isWon: column.stage.is_won,
    isLost: column.stage.is_lost,
  }));

  const leads: PipelineLeadModel[] = board.columns
    .flatMap((column) => column.leads)
    // `owner_id` is a uuid column, so "unassigned" cannot be pushed into the query.
    .filter((lead) => (ownerParam === "unassigned" ? lead.owner_id === null : true))
    .map((lead) => {
      const service = lead.primaryServiceKey ? serviceLabels.get(lead.primaryServiceKey) : undefined;
      return {
        id: lead.id,
        stageId: lead.stage_id,
        status: lead.status,
        businessId: lead.business_id,
        businessName: lead.businessName,
        city: lead.city,
        district: lead.district,
        overallScore: lead.overallScore,
        primaryServiceName: service?.name ?? null,
        primaryServiceIcon: service?.icon ?? null,
        ownerId: lead.owner_id,
        ownerName: lead.owner_id ? (ownerNames.get(lead.owner_id) ?? null) : null,
        estimatedValue: lead.estimated_value,
        wonValue: lead.won_value,
        currency: lead.currency,
        nextFollowUpLabel: formatDate(lead.next_follow_up_at, ctx.locale),
        followUpDue: isDue(lead.next_follow_up_at),
        lastContactedLabel: formatDate(lead.last_contacted_at, ctx.locale),
      } satisfies PipelineLeadModel;
    });

  const currency = leads[0]?.currency ?? board.currency;
  const money = new Intl.NumberFormat(ctx.locale === "en" ? "en-GB" : "tr-TR", { style: "currency", currency, maximumFractionDigits: 0 });
  const totals = {
    leads: leads.length,
    open: leads.filter((lead) => lead.status === "open").length,
    won: leads.filter((lead) => lead.status === "won").length,
    lost: leads.filter((lead) => lead.status === "lost").length,
    estimatedValue: leads.reduce((sum, lead) => sum + (lead.estimatedValue ?? 0), 0),
    wonValue: leads.reduce((sum, lead) => sum + (lead.wonValue ?? 0), 0),
    dueFollowUps: leads.filter((lead) => lead.followUpDue).length,
  };

  const filtered = q !== "" || ownerParam !== "all" || Boolean(status) || dueOnly;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button variant="outline" render={<Link href="/opportunities" />}>
            <Target />
            {t("empty.action")}
          </Button>
        }
      />

      <Card size="sm">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <Kpi label={t("summary.leads")} value={totals.leads} />
          <Kpi label={t("summary.open")} value={totals.open} />
          <Kpi label={t("summary.won")} value={totals.won} tone="positive" />
          <Kpi label={t("summary.lost")} value={totals.lost} tone="neutral" />
          <Kpi label={t("summary.estimatedValue")} value={money.format(totals.estimatedValue)} hint={t("summary.estimatedValueHint")} />
          <Kpi label={t("summary.dueFollowUps")} value={totals.dueFollowUps} tone={totals.dueFollowUps > 0 ? "attention" : undefined} />
        </CardContent>
      </Card>

      <PipelineToolbar owners={owners} />

      <PipelineBoard stages={stages} leads={leads} filtered={filtered} />

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">{t("reminderNotice")}</p>
        <GoogleAttribution variant="full" />
      </div>
    </>
  );
}
