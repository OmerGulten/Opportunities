"use client";

import { DataTable, DemoBadge, type DataTableColumn } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/client";

export interface AdminProviderItem {
  capability: "places" | "ai" | "performance";
  /** Provider identifier as the registry reports it, e.g. `google_places`. */
  provider: string;
  demo: boolean;
  /** Extra line such as the AI model in use. */
  detail: string | null;
}

/** Which implementation is serving each capability right now. */
export function ProvidersTable({ items }: { items: AdminProviderItem[] }) {
  const t = useT("admin");

  const columns: Array<DataTableColumn<AdminProviderItem>> = [
    { key: "capability", header: t("providers.columns.capability"), cell: (row) => <span className="font-medium">{t(`providers.capabilities.${row.capability}`)}</span> },
    { key: "provider", header: t("providers.columns.provider"), cell: (row) => <span className="font-mono text-xs">{row.provider}</span> },
    {
      key: "mode",
      header: t("providers.columns.mode"),
      cell: (row) =>
        row.demo ? (
          <DemoBadge />
        ) : (
          <Badge variant="outline" className="border-emerald-600/25 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300">
            {t("providers.modeLive")}
          </Badge>
        ),
    },
    {
      key: "detail",
      header: t("providers.columns.detail"),
      cell: (row) => (row.detail ? <span className="text-xs text-muted-foreground">{row.detail}</span> : <span className="text-xs text-muted-foreground">—</span>),
    },
  ];

  return <DataTable columns={columns} rows={items} rowKey={(row) => row.capability} />;
}
