"use client";

import { useState, useTransition } from "react";

import { DataTable, InlineAlert, PaginationControls, type DataTableColumn } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatters, useT } from "@/lib/i18n/client";

export interface CreditLedgerEntry {
  id: string;
  type: string;
  /** Effect on the available balance. 0 for a reservation-served consumption. */
  amount: number;
  /** Credits the entry was actually for. This is the figure worth showing. */
  quantity: number;
  balanceAfter: number;
  referenceType: string | null;
  createdAt: string;
}

export interface CreditLedgerTableProps {
  initialItems: CreditLedgerEntry[];
  initialTotal: number;
  pageSize: number;
}

interface LedgerApiRow {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  reference_type: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

function toEntry(row: LedgerApiRow): CreditLedgerEntry {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    quantity: quantityOf(row),
    balanceAfter: row.balance_after,
    referenceType: row.reference_type,
    createdAt: row.created_at,
  };
}

/**
 * Mirrors ledgerQuantity() on the server: the signed amount is 0 whenever the
 * credits already left the balance at reservation time, so the recorded
 * quantity is what the row was really for.
 */
function quantityOf(row: LedgerApiRow): number {
  const recorded = row.metadata?.quantity;
  if (typeof recorded === "number" && Number.isInteger(recorded) && recorded >= 0) return recorded;
  return Math.abs(row.amount);
}

const INBOUND_TYPES = new Set(["monthly_grant", "purchase", "refund"]);

const KNOWN_TYPES = new Set([
  "monthly_grant",
  "purchase",
  "reservation",
  "consumption",
  "refund",
  "admin_adjustment",
  "expiration",
]);

/**
 * The immutable credit ledger.
 *
 * The first page is rendered on the server; later pages are fetched from
 * /api/credits/ledger in the click handler, so no effect ever drives state.
 */
export function CreditLedgerTable({ initialItems, initialTotal, pageSize }: CreditLedgerTableProps) {
  const t = useT("billing");
  const { number, dateTime } = useFormatters();
  const [pending, startTransition] = useTransition();

  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);

  function goToPage(next: number) {
    startTransition(async () => {
      try {
        const offset = (next - 1) * pageSize;
        const response = await fetch(`/api/credits/ledger?limit=${pageSize}&offset=${offset}`, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) throw new Error(`ledger_request_failed_${response.status}`);
        const payload = (await response.json()) as { data?: { items?: LedgerApiRow[]; total?: number } };
        setItems((payload.data?.items ?? []).map(toEntry));
        setTotal(payload.data?.total ?? 0);
        setPage(next);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    });
  }

  const columns: Array<DataTableColumn<CreditLedgerEntry>> = [
    {
      key: "date",
      header: t("ledger.columns.date"),
      cell: (entry) => <span className="text-muted-foreground tabular-nums">{dateTime(entry.createdAt)}</span>,
    },
    {
      key: "type",
      header: t("ledger.columns.type"),
      cell: (entry) => (
        <Badge variant="outline" className="font-normal">
          {KNOWN_TYPES.has(entry.type) ? t(`ledger.types.${entry.type}`) : entry.type}
        </Badge>
      ),
    },
    {
      key: "amount",
      header: t("ledger.columns.amount"),
      align: "end",
      cell: (entry) => {
        const inbound = INBOUND_TYPES.has(entry.type);
        return (
          <span
            className={
              entry.quantity === 0
                ? "tabular-nums text-muted-foreground"
                : inbound
                  ? "font-medium text-emerald-600 tabular-nums dark:text-emerald-400"
                  : "font-medium text-foreground tabular-nums"
            }
          >
            {entry.quantity === 0 ? number(0) : `${inbound ? "+" : "-"}${number(entry.quantity)}`}
          </span>
        );
      },
    },
    {
      key: "balance",
      header: t("ledger.columns.balance"),
      align: "end",
      cell: (entry) => <span className="text-muted-foreground tabular-nums">{number(entry.balanceAfter)}</span>,
    },
    {
      key: "reference",
      header: t("ledger.columns.reference"),
      cell: (entry) => <span className="text-muted-foreground">{entry.referenceType ?? t("ledger.noReference")}</span>,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("ledger.title")}</CardTitle>
        <CardDescription>{t("ledger.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {failed ? <InlineAlert tone="negative">{t("ledger.loadFailed")}</InlineAlert> : null}
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(entry) => entry.id}
          loading={pending}
          skeletonRows={Math.min(pageSize, 5)}
          emptyState={<p className="p-6 text-center text-sm text-muted-foreground">{t("ledger.empty")}</p>}
        />
        {total > pageSize ? <PaginationControls page={page} pageSize={pageSize} total={total} onChange={goToPage} /> : null}
        <p className="text-xs text-muted-foreground">{t("credits.note")}</p>
      </CardContent>
    </Card>
  );
}
