"use client";

import { cn } from "cn";
import { Building2, Search, X } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useState, useTransition, type FormEvent } from "react";

import { DataTable, EmptyState, PaginationControls, toneBadgeClass, type DataTableColumn } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormatters, useT } from "@/lib/i18n/client";

import { AdjustCreditsDialog } from "./adjust-credits-dialog";
import { UnlimitedBillingDialog } from "./unlimited-billing-dialog";

export interface AdminWorkspaceListItem {
  id: string;
  name: string;
  slug: string;
  planKey: string | null;
  memberCount: number;
  available: number;
  reserved: number;
  lifetimeConsumed: number;
  /** Billing only: the account records usage but is never charged for it. */
  unlimited: boolean;
  scans: number;
  businesses: number;
  createdAt: string;
}

export interface WorkspacesTableProps {
  items: AdminWorkspaceListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** The `q` the server actually filtered on, so the input reflects the rendered result. */
  query: string;
}

/**
 * Cross-tenant workspace list.
 *
 * The search term and page live in the URL (nuqs, `shallow: false`) so a
 * filtered view can be shared and survives navigating away and back; the server
 * component re-queries on every change.
 */
export function WorkspacesTable({ items, total, page, pageSize, query }: WorkspacesTableProps) {
  const t = useT("admin");
  const tc = useT("common");
  const { number, date } = useFormatters();
  const [isPending, startTransition] = useTransition();

  const [, setQ] = useQueryState("q", parseAsString.withDefault("").withOptions({ shallow: false, startTransition, clearOnDefault: true }));
  const [, setPage] = useQueryState("page", parseAsInteger.withDefault(1).withOptions({ shallow: false, startTransition, clearOnDefault: true }));
  const [draft, setDraft] = useState(query);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void setQ(draft.trim() === "" ? null : draft.trim());
    void setPage(1);
  }

  function clearSearch() {
    setDraft("");
    void setQ(null);
    void setPage(1);
  }

  const columns: Array<DataTableColumn<AdminWorkspaceListItem>> = [
    {
      key: "name",
      header: t("workspaces.columns.name"),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{row.slug}</p>
        </div>
      ),
    },
    {
      key: "plan",
      header: t("workspaces.columns.plan"),
      cell: (row) =>
        row.planKey ? (
          <Badge variant="outline" className="font-mono text-xs">
            {row.planKey}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{t("workspaces.noPlan")}</span>
        ),
    },
    { key: "members", header: t("workspaces.columns.members"), align: "end", cell: (row) => number(row.memberCount) },
    {
      key: "billing",
      header: t("workspaces.columns.billing"),
      cell: (row) => (
        <Badge variant="outline" className={cn(toneBadgeClass[row.unlimited ? "info" : "neutral"], "text-xs")}>
          {row.unlimited ? t("workspaces.billing.unlimited") : t("workspaces.billing.metered")}
        </Badge>
      ),
    },
    {
      key: "credits",
      header: t("workspaces.columns.credits"),
      align: "end",
      cell: (row) =>
        // An unlimited account still has a balance row, but nothing is charged
        // against it, so showing the number would invite the wrong reading.
        row.unlimited ? (
          <span className="text-xs text-muted-foreground">{t("workspaces.billing.notCharged")}</span>
        ) : (
          <div className="leading-tight">
            <p className="font-medium tabular-nums">{number(row.available)}</p>
            {row.reserved > 0 ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("workspaces.columns.reserved")}: {number(row.reserved)}
              </p>
            ) : null}
          </div>
        ),
    },
    { key: "consumed", header: t("workspaces.columns.consumed"), align: "end", cell: (row) => number(row.lifetimeConsumed) },
    { key: "scans", header: t("workspaces.columns.scans"), align: "end", cell: (row) => number(row.scans) },
    { key: "businesses", header: t("workspaces.columns.businesses"), align: "end", cell: (row) => number(row.businesses) },
    {
      key: "created",
      header: t("workspaces.columns.created"),
      cell: (row) => <span className="text-xs text-muted-foreground">{date(row.createdAt)}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("workspaces.columns.actions")}</span>,
      align: "end",
      cell: (row) => (
        <div className="flex items-center justify-end gap-2">
          <AdjustCreditsDialog workspaceId={row.id} workspaceName={row.name} balance={row.available} unlimited={row.unlimited} />
          <UnlimitedBillingDialog workspaceId={row.id} workspaceName={row.name} unlimited={row.unlimited} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={submitSearch} className="flex w-full max-w-sm items-center gap-2">
          <Input
            type="search"
            name="q"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("workspaces.search")}
            aria-label={t("workspaces.search")}
          />
          <Button type="submit" variant="outline" size="sm" disabled={isPending}>
            <Search />
            <span className="sr-only sm:not-sr-only">{t("workspaces.searchAction")}</span>
          </Button>
          {query ? (
            <Button type="button" variant="ghost" size="icon-sm" onClick={clearSearch} aria-label={tc("actions.clearFilters")}>
              <X />
            </Button>
          ) : null}
        </form>
        <p className="text-sm text-muted-foreground tabular-nums">{t("workspaces.total", { count: number(total) })}</p>
      </div>

      <div className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={isPending}>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(row) => row.id}
          emptyState={
            <EmptyState
              bordered={false}
              icon={<Building2 />}
              title={t("workspaces.empty")}
              description={t("workspaces.emptyHint")}
              action={
                query ? (
                  <Button variant="outline" size="sm" onClick={clearSearch}>
                    <X />
                    {tc("actions.clearFilters")}
                  </Button>
                ) : null
              }
            />
          }
        />
      </div>

      {total > pageSize ? <PaginationControls page={page} pageSize={pageSize} total={total} onChange={(next) => void setPage(next)} /> : null}
    </div>
  );
}
