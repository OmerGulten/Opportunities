"use client";

import { Layers } from "lucide-react";

import { DataTable, EmptyState, type DataTableColumn } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { useFormatters, useT } from "@/lib/i18n/client";

export interface AdminPlanItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthlyCredits: number;
  priceMonthly: number;
  currency: string;
  maxMembers: number;
  isDefault: boolean;
  active: boolean;
  /** Feature keys that are enabled on the plan; values are not shown verbatim. */
  features: string[];
}

/** Read-only view of the `plans` table. Plan definitions ship with migrations. */
export function PlansTable({ items }: { items: AdminPlanItem[] }) {
  const t = useT("admin");
  const { number, currency } = useFormatters();

  const columns: Array<DataTableColumn<AdminPlanItem>> = [
    {
      key: "name",
      header: t("plans.columns.name"),
      cell: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            {row.name}
            {row.isDefault ? (
              <Badge variant="outline" className="border-sky-600/25 bg-sky-500/12 text-sky-700 dark:border-sky-400/25 dark:text-sky-300">
                {t("plans.columns.isDefault")}
              </Badge>
            ) : null}
          </p>
          {row.description ? <p className="truncate text-xs text-muted-foreground">{row.description}</p> : null}
        </div>
      ),
    },
    { key: "key", header: t("plans.columns.key"), cell: (row) => <span className="font-mono text-xs text-muted-foreground">{row.key}</span> },
    { key: "monthlyCredits", header: t("plans.columns.monthlyCredits"), align: "end", cell: (row) => number(row.monthlyCredits) },
    { key: "price", header: t("plans.columns.price"), align: "end", cell: (row) => currency(row.priceMonthly, row.currency) },
    { key: "maxMembers", header: t("plans.columns.maxMembers"), align: "end", cell: (row) => number(row.maxMembers) },
    {
      key: "features",
      header: t("plans.columns.features"),
      cell: (row) =>
        row.features.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t("plans.noFeatures")}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.features.map((feature) => (
              <Badge key={feature} variant="outline" className="font-mono text-[0.7rem]">
                {feature}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      key: "active",
      header: t("plans.columns.active"),
      align: "end",
      cell: (row) => (
        <Badge
          variant="outline"
          className={
            row.active
              ? "border-emerald-600/25 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300"
              : "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:border-slate-400/20 dark:text-slate-300"
          }
        >
          {row.active ? t("common.active") : t("common.inactive")}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={items}
      rowKey={(row) => row.id}
      emptyState={<EmptyState bordered={false} icon={<Layers />} title={t("plans.empty")} />}
    />
  );
}
