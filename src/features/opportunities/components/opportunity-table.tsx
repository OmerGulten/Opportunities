"use client";

import { Radar, Target } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DataTable, EmptyState, ScoreBadge, ServiceBadge, type DataTableColumn } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFormatters, useT } from "@/lib/i18n/client";

import type { OpportunityListItem } from "../queries";
import { BulkActionBar, type BulkTarget } from "./bulk-actions";
import { BusinessRowActions } from "./business-row-actions";
import { DigitalGapBadges, GoogleCompletenessCell, InstagramStatusCell, WebsiteStatusCell } from "./cells";
import { useListFilters } from "./filter-state";
import { ListPagination } from "./list-pagination";

export interface OpportunityTableProps {
  rows: OpportunityListItem[];
  total: number;
  /** Category id -> localized label. */
  categoryLabels: Record<string, string>;
  /** Service id -> `services.icon` value, so a service keeps one colour. */
  serviceIcons: Record<string, string | null>;
  /** The service the list is filtered by, when one is selected. */
  filteredService: { id: string; label: string } | null;
}

export function OpportunityTable({ rows, total, categoryLabels, serviceIcons, filteredService }: OpportunityTableProps) {
  const t = useT("opportunities");
  const { relative } = useFormatters();
  const { clear } = useListFilters();
  const [selected, setSelected] = useState<string[]>([]);

  const selectedTargets: BulkTarget[] = rows
    .filter((row) => selected.includes(row.id))
    .map((row) => ({
      id: row.id,
      inPipeline: Boolean(row.lead_id),
      isIgnored: row.is_ignored,
      primaryServiceId: row.primary_service_id,
    }));

  const columns: Array<DataTableColumn<OpportunityListItem>> = [
    {
      key: "business",
      header: t("columns.business"),
      cell: (row) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={`/businesses/${row.id}`} className="truncate font-medium hover:underline">
            {row.display_name ?? t("cells.unnamed")}
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            {row.primary_category_id ? (categoryLabels[row.primary_category_id] ?? t("cells.noCategory")) : t("cells.noCategory")}
          </span>
          {row.is_ignored ? (
            <span className="text-xs text-muted-foreground">{t("cells.ignored")}</span>
          ) : null}
        </div>
      ),
      className: "min-w-52",
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
          <span className="text-xs text-muted-foreground">{t("cells.noLocation")}</span>
        ),
    },
    {
      key: "opportunity",
      header: t("columns.opportunity"),
      cell: (row) =>
        row.primaryServiceLabel ? (
          <ServiceBadge name={row.primaryServiceLabel} icon={row.primary_service_id ? serviceIcons[row.primary_service_id] : null} />
        ) : (
          <span className="text-xs text-muted-foreground">{t("cells.noService")}</span>
        ),
    },
    {
      key: "score",
      header: t("columns.score"),
      align: "center",
      cell: (row) => (
        <div className="flex flex-col items-center gap-1">
          <ScoreBadge score={row.overall_score} />
          {filteredService && row.filteredServiceScore !== null ? (
            <span className="text-[0.7rem] text-muted-foreground tabular-nums">
              {t("summary.serviceScore", { service: filteredService.label })}: {row.filteredServiceScore}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "gaps",
      header: t("columns.gaps"),
      cell: (row) => <DigitalGapBadges gaps={row.digital_gaps} />,
      className: "min-w-44",
    },
    { key: "website", header: t("columns.website"), cell: (row) => <WebsiteStatusCell status={row.website_status} /> },
    { key: "instagram", header: t("columns.instagram"), cell: (row) => <InstagramStatusCell status={row.instagram_status} /> },
    { key: "google", header: t("columns.google"), cell: (row) => <GoogleCompletenessCell value={row.google_completeness} /> },
    {
      key: "pipeline",
      header: t("columns.pipeline"),
      cell: (row) =>
        row.lead_id && row.stageName ? (
          <Badge variant="outline" className="font-normal">
            {row.stageName}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{t("cells.notInPipeline")}</span>
        ),
    },
    {
      key: "lastContact",
      header: t("columns.lastContact"),
      cell: (row) =>
        row.last_contacted_at ? (
          <span className="text-xs">{relative(row.last_contacted_at)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t("cells.never")}</span>
        ),
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
      <BulkActionBar targets={selectedTargets} onClear={() => setSelected([])} />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        selectable
        selectedKeys={selected}
        onSelectionChange={setSelected}
        emptyState={
          <EmptyState
            icon={<Target />}
            title={t("empty.title")}
            description={t("empty.description")}
            bordered={false}
            action={
              <>
                <Button variant="outline" size="sm" onClick={clear}>
                  {t("empty.clear")}
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
