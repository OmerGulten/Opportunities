"use client";

import { Building2, Radar } from "lucide-react";
import Link from "next/link";

import { DataTable, EmptyState, ScoreBadge, ServiceBadge, toneBadgeClass } from "@/components/shared";
import type { DataTableColumn } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BusinessRowActions } from "@/features/opportunities/components/business-row-actions";
import { GoogleCompletenessCell, InstagramStatusCell, WebsiteStatusCell } from "@/features/opportunities/components/cells";
import { useListFilters } from "@/features/opportunities/components/filter-state";
import { ListPagination } from "@/features/opportunities/components/list-pagination";
import type { OpportunityListItem } from "@/features/opportunities/queries";
import { useT } from "@/lib/i18n/client";

export interface BusinessTableProps {
  rows: OpportunityListItem[];
  total: number;
  categoryLabels: Record<string, string>;
  serviceIcons: Record<string, string | null>;
  /** Server time used to decide whether a provider snapshot has expired. */
  now: string;
}

/**
 * The same population as the opportunity list without the ranking emphasis:
 * presence and provider status first, score last.
 */
export function BusinessTable({ rows, total, categoryLabels, serviceIcons, now }: BusinessTableProps) {
  const t = useT("businesses");
  const to = useT("opportunities");
  const { clear } = useListFilters();
  const nowMs = new Date(now).getTime();

  const columns: Array<DataTableColumn<OpportunityListItem>> = [
    {
      key: "business",
      header: t("columns.business"),
      cell: (row) => (
        <Link href={`/businesses/${row.id}`} className="truncate font-medium hover:underline">
          {row.display_name ?? to("cells.unnamed")}
        </Link>
      ),
      className: "min-w-52",
    },
    {
      key: "category",
      header: t("columns.category"),
      cell: (row) => (
        <span className="text-sm">
          {row.primary_category_id ? (categoryLabels[row.primary_category_id] ?? to("cells.noCategory")) : to("cells.noCategory")}
        </span>
      ),
    },
    {
      key: "location",
      header: t("columns.location"),
      cell: (row) =>
        row.district || row.city ? (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate">{row.district ?? row.city}</span>
            {row.district && row.city ? <span className="truncate text-xs text-muted-foreground">{row.city}</span> : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{to("cells.noLocation")}</span>
        ),
    },
    { key: "website", header: t("columns.website"), cell: (row) => <WebsiteStatusCell status={row.website_status} /> },
    { key: "instagram", header: t("columns.instagram"), cell: (row) => <InstagramStatusCell status={row.instagram_status} /> },
    { key: "google", header: t("columns.google"), cell: (row) => <GoogleCompletenessCell value={row.google_completeness} /> },
    {
      key: "service",
      header: t("columns.service"),
      cell: (row) =>
        row.primaryServiceLabel ? (
          <ServiceBadge name={row.primaryServiceLabel} icon={row.primary_service_id ? serviceIcons[row.primary_service_id] : null} />
        ) : (
          <span className="text-xs text-muted-foreground">{to("cells.noService")}</span>
        ),
    },
    {
      key: "score",
      header: t("columns.score"),
      align: "center",
      cell: (row) => <ScoreBadge score={row.overall_score} />,
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => {
        const stale = row.snapshot_expires_at ? new Date(row.snapshot_expires_at).getTime() < nowMs : false;
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant="outline" className={row.is_ignored ? toneBadgeClass.neutral : toneBadgeClass.positive}>
              {row.is_ignored ? t("status.ignored") : t("status.active")}
            </Badge>
            {stale ? (
              <Badge variant="outline" className={toneBadgeClass.attention}>
                {t("status.stale")}
              </Badge>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      align: "end",
      cell: (row) => (
        <BusinessRowActions
          businessId={row.id}
          isIgnored={row.is_ignored}
          inPipeline={Boolean(row.lead_id)}
          primaryServiceId={row.primary_service_id}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyState={
          <EmptyState
            icon={<Building2 />}
            title={t("empty.title")}
            description={t("empty.description")}
            bordered={false}
            action={
              <>
                <Button variant="outline" size="sm" onClick={clear}>
                  {to("empty.clear")}
                </Button>
                <Button size="sm" render={<Link href="/scans/new" />}>
                  <Radar />
                  {t("empty.newScan")}
                </Button>
              </>
            }
          />
        }
      />
      <ListPagination total={total} />
    </div>
  );
}
