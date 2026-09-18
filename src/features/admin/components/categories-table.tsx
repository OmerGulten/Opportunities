"use client";

import { Tags } from "lucide-react";

import { DataTable, EmptyState, type DataTableColumn } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { useFormatters, useT } from "@/lib/i18n/client";

export interface AdminCategoryMapping {
  id: string;
  provider: string;
  providerType: string | null;
  queryText: string | null;
  priority: number;
  active: boolean;
}

export interface AdminCategoryItem {
  id: string;
  key: string;
  nameTr: string;
  nameEn: string;
  sortOrder: number;
  active: boolean;
  mappings: AdminCategoryMapping[];
}

/** Read-only view of `categories` and the provider queries each one expands into. */
export function CategoriesTable({ items }: { items: AdminCategoryItem[] }) {
  const t = useT("admin");
  const { number } = useFormatters();

  const columns: Array<DataTableColumn<AdminCategoryItem>> = [
    { key: "key", header: t("categories.columns.key"), cell: (row) => <span className="font-mono text-xs">{row.key}</span> },
    { key: "nameTr", header: t("categories.columns.nameTr"), cell: (row) => <span className="font-medium">{row.nameTr}</span> },
    { key: "nameEn", header: t("categories.columns.nameEn"), cell: (row) => row.nameEn },
    {
      key: "mappings",
      header: t("categories.columns.mappings"),
      cell: (row) =>
        row.mappings.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t("categories.mappingsEmpty")}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.mappings.map((mapping) => (
              <Badge
                key={mapping.id}
                variant="outline"
                className={mapping.active ? "font-mono text-[0.7rem]" : "font-mono text-[0.7rem] opacity-60"}
                title={t("categories.mappingTitle", { provider: mapping.provider, priority: mapping.priority })}
              >
                {mapping.providerType ?? mapping.queryText ?? mapping.provider}
              </Badge>
            ))}
          </div>
        ),
    },
    { key: "sortOrder", header: t("categories.columns.sortOrder"), align: "end", cell: (row) => number(row.sortOrder) },
    {
      key: "active",
      header: t("categories.columns.active"),
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
      emptyState={<EmptyState bordered={false} icon={<Tags />} title={t("categories.empty")} />}
    />
  );
}
