"use client";

import { ExternalLink, Radar } from "lucide-react";
import Link from "next/link";

import { DataTable, DemoBadge, EmptyState, type DataTableColumn } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ScanListItem } from "@/features/scans/queries";
import { useFormatters, useT } from "@/lib/i18n/client";

import { ScanActions } from "./scan-actions";
import { ScanAreaSummary } from "./scan-area-summary";
import { ScanProgressBar } from "./scan-progress-bar";
import { ScanStatusBadge } from "./scan-status-badge";

export interface ScanListTableProps {
  scans: ScanListItem[];
}

/** Scan list. Rows are already resolved on the server; this only renders them. */
export function ScanListTable({ scans }: ScanListTableProps) {
  const t = useT("scans");
  const { number, date } = useFormatters();

  const columns: Array<DataTableColumn<ScanListItem>> = [
    {
      key: "name",
      header: t("list.columns.name"),
      cell: (scan) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={`/scans/${scan.id}`} className="truncate font-medium underline-offset-4 hover:underline">
            {scan.name}
          </Link>
          <ScanAreaSummary scan={scan} />
          {scan.is_demo ? <DemoBadge withTooltip={false} className="mt-0.5 w-fit" /> : null}
        </div>
      ),
    },
    {
      key: "categories",
      header: t("list.columns.categories"),
      cell: (scan) =>
        scan.categoryNames.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {scan.categoryNames.slice(0, 2).map((name) => (
              <Badge key={name} variant="outline" className="font-normal">
                {name}
              </Badge>
            ))}
            {scan.categoryNames.length > 2 ? (
              <Badge variant="outline" className="font-normal text-muted-foreground">
                +{scan.categoryNames.length - 2}
              </Badge>
            ) : null}
          </div>
        ),
    },
    {
      key: "depth",
      header: t("list.columns.depth"),
      cell: (scan) => <span className="text-muted-foreground">{t(`wizard.depth.options.${scan.audit_depth}.label`)}</span>,
    },
    {
      key: "status",
      header: t("list.columns.status"),
      cell: (scan) => (
        <div className="flex min-w-36 flex-col gap-1.5">
          <ScanStatusBadge status={scan.status} />
          <ScanProgressBar percent={scan.progress.percent} status={scan.status} />
        </div>
      ),
    },
    {
      key: "counts",
      header: t("list.columns.counts"),
      cell: (scan) => (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
          <CountEntry label={t("counters.discovered")} value={number(scan.discovered_count)} />
          <CountEntry label={t("counters.audited")} value={number(scan.audited_count)} />
          <CountEntry label={t("counters.scored")} value={number(scan.scored_count)} />
          <CountEntry
            label={t("counters.failed")}
            value={number(scan.failed_count)}
            tone={scan.failed_count > 0 ? "text-rose-600 dark:text-rose-400" : undefined}
          />
        </dl>
      ),
    },
    {
      key: "credits",
      header: t("list.columns.credits"),
      align: "end",
      cell: (scan) => (
        <div className="flex flex-col items-end text-xs tabular-nums">
          <span className="font-medium">{number(scan.consumed_credits)}</span>
          <span className="text-muted-foreground">{t("list.estimatedCredits", { value: number(scan.estimated_credits) })}</span>
        </div>
      ),
    },
    {
      key: "created",
      header: t("list.columns.created"),
      cell: (scan) => <span className="text-xs text-muted-foreground">{date(scan.created_at)}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("list.columns.actions")}</span>,
      align: "end",
      cell: (scan) => (
        <div className="flex items-center justify-end gap-1">
          <ScanActions scanId={scan.id} scanName={scan.name} status={scan.status} />
          <Button variant="ghost" size="icon-sm" render={<Link href={`/scans/${scan.id}`} />} aria-label={t("list.open")}>
            <ExternalLink />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={scans}
      rowKey={(scan) => scan.id}
      emptyState={
        <EmptyState
          bordered={false}
          icon={<Radar />}
          title={t("list.emptyTitle")}
          description={t("list.emptyBody")}
          action={
            <Button render={<Link href="/scans/new" />}>
              <Radar />
              {t("list.newScan")}
            </Button>
          }
        />
      }
    />
  );
}

function CountEntry({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={tone ?? "tabular-nums"}>{value}</dd>
    </div>
  );
}
