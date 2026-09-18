"use client";

import { CircleCheck, Filter, X } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useState, useTransition, type FormEvent } from "react";

import { CopyButton, DataTable, EmptyState, type DataTableColumn } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormatters, useT } from "@/lib/i18n/client";

export interface AdminFailedJobItem {
  id: string;
  scanId: string;
  scanName: string | null;
  jobType: "discovery" | "dedupe" | "audit" | "scoring" | "finalize";
  attempt: number;
  maxAttempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  updatedAt: string;
}

export interface FailedJobsTableProps {
  items: AdminFailedJobItem[];
  /** The scan filter the server applied, mirrored from the URL. */
  scanId: string;
  limit: number;
}

/** Failed workflow steps, optionally narrowed to one scan through the URL. */
export function FailedJobsTable({ items, scanId, limit }: FailedJobsTableProps) {
  const t = useT("admin");
  const { number, dateTime } = useFormatters();
  const [isPending, startTransition] = useTransition();
  const [, setScan] = useQueryState("scan", parseAsString.withDefault("").withOptions({ shallow: false, startTransition, clearOnDefault: true }));
  const [draft, setDraft] = useState(scanId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void setScan(draft.trim() === "" ? null : draft.trim());
  }

  function clear() {
    setDraft("");
    void setScan(null);
  }

  const columns: Array<DataTableColumn<AdminFailedJobItem>> = [
    {
      key: "scan",
      header: t("jobs.columns.scan"),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.scanName ?? t("jobs.unknownScan")}</p>
          <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <span className="truncate">{row.scanId}</span>
            <CopyButton value={row.scanId} size="icon-xs" />
          </span>
        </div>
      ),
    },
    { key: "type", header: t("jobs.columns.type"), cell: (row) => t(`jobs.types.${row.jobType}`) },
    {
      key: "attempt",
      header: t("jobs.columns.attempt"),
      align: "end",
      cell: (row) => <span className="tabular-nums">{t("jobs.attemptValue", { attempt: number(row.attempt), max: number(row.maxAttempts) })}</span>,
    },
    {
      key: "error",
      header: t("jobs.columns.error"),
      cell: (row) => (
        <div className="min-w-0 max-w-md space-y-1">
          {row.errorCode ? (
            <Badge variant="outline" className="border-rose-600/25 bg-rose-500/12 font-mono text-[0.7rem] text-rose-700 dark:border-rose-400/25 dark:text-rose-300">
              {row.errorCode}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">{t("jobs.noError")}</span>
          )}
          {row.errorMessage ? <p className="text-xs break-words text-muted-foreground">{row.errorMessage}</p> : null}
        </div>
      ),
    },
    {
      key: "updated",
      header: t("jobs.columns.updated"),
      cell: (row) => <span className="text-xs text-muted-foreground whitespace-nowrap">{dateTime(row.updatedAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={submit} className="flex w-full max-w-md items-center gap-2">
          <Input
            name="scan"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("jobs.filterScanPlaceholder")}
            aria-label={t("jobs.filterScan")}
            className="font-mono text-xs"
          />
          <Button type="submit" variant="outline" size="sm" disabled={isPending}>
            <Filter />
            <span className="sr-only sm:not-sr-only">{t("jobs.filterApply")}</span>
          </Button>
          {scanId ? (
            <Button type="button" variant="ghost" size="icon-sm" onClick={clear} aria-label={t("jobs.filterClear")}>
              <X />
            </Button>
          ) : null}
        </form>
        <p className="text-sm text-muted-foreground tabular-nums">{t("jobs.limitNotice", { count: number(limit) })}</p>
      </div>

      <div className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={isPending}>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(row) => row.id}
          emptyState={<EmptyState bordered={false} icon={<CircleCheck />} title={t("jobs.empty")} description={t("jobs.emptyHint")} />}
        />
      </div>
    </div>
  );
}
