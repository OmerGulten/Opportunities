"use client";

import { cn } from "cn";

import { DataTable, EmptyState, toneBadgeClass, type DataTableColumn, type Tone } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { useFormatters, useT } from "@/lib/i18n/client";
import type { ScanTargetRow } from "@/types/db";

type TargetStatus = ScanTargetRow["status"];

const targetTone: Record<TargetStatus, Tone> = {
  pending: "neutral",
  running: "info",
  completed: "positive",
  failed: "negative",
  skipped: "attention",
};

export interface ScanTargetsTableProps {
  targets: ScanTargetRow[];
  /** category id -> already localized name. */
  categoryNames: Record<string, string>;
}

/**
 * One row per coverage cell and category: the unit of work the discovery step
 * claims. `results_count` is what the provider returned for that cell, which is
 * a sweep of the area and not a complete census of it.
 */
export function ScanTargetsTable({ targets, categoryNames }: ScanTargetsTableProps) {
  const t = useT("scans");
  const tc = useT("common");
  const te = useT("errors");
  const { number } = useFormatters();

  const columns: Array<DataTableColumn<ScanTargetRow>> = [
    {
      key: "cell",
      header: t("targets.columns.cell"),
      cell: (target) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium tabular-nums">#{number(target.cell_index + 1)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {target.center_lat.toFixed(4)}, {target.center_lng.toFixed(4)} · {number(target.radius_m)} {tc("units.m")}
          </span>
        </div>
      ),
    },
    {
      key: "category",
      header: t("targets.columns.category"),
      cell: (target) => categoryNames[target.category_id] ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: "status",
      header: t("targets.columns.status"),
      cell: (target) => (
        <Badge variant="outline" className={cn(toneBadgeClass[targetTone[target.status]])}>
          {t(`targets.status.${target.status}`)}
        </Badge>
      ),
    },
    {
      key: "results",
      header: t("targets.columns.results"),
      align: "end",
      cell: (target) => <span className="tabular-nums">{number(target.results_count)}</span>,
    },
    {
      key: "calls",
      header: t("targets.columns.providerCalls"),
      align: "end",
      cell: (target) => <span className="tabular-nums text-muted-foreground">{number(target.provider_calls)}</span>,
    },
    {
      key: "error",
      header: t("targets.columns.error"),
      cell: (target) =>
        target.error_code ? (
          <span className="text-xs text-rose-600 dark:text-rose-400">{te(target.error_code)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={targets}
      rowKey={(target) => target.id}
      emptyState={<EmptyState bordered={false} title={t("targets.emptyTitle")} description={t("targets.emptyBody")} />}
    />
  );
}
