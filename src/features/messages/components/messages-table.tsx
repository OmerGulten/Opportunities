"use client";

import { cn } from "cn";
import { Archive, Building2, Eye, PenLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsInteger, useQueryState } from "nuqs";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog, CopyButton, DataTable, EmptyState, PaginationControls, type DataTableColumn } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setMessageStatusAction } from "@/features/messages/actions";
import { useFormatters, useT } from "@/lib/i18n/client";
import type { MessageChannel } from "@/types/common";

import type { MessageStatusValue } from "./options";

export interface MessageListRow {
  id: string;
  businessId: string;
  /** Null when the provider snapshot for the business is missing. */
  businessName: string | null;
  channel: MessageChannel;
  status: MessageStatusValue;
  serviceName: string | null;
  subject: string | null;
  body: string;
  createdAt: string;
}

export interface MessagesTableProps {
  rows: MessageListRow[];
  total: number;
  page: number;
  pageSize: number;
  /** True when at least one filter is active, so "no results" differs from "no data". */
  filtered: boolean;
}

const statusTone: Record<MessageStatusValue, string> = {
  draft: "text-muted-foreground",
  edited: "border-sky-600/25 text-sky-700 dark:border-sky-400/25 dark:text-sky-300",
  copied: "border-emerald-600/25 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300",
  channel_opened: "border-emerald-600/25 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300",
  sent_manually: "border-emerald-600/25 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300",
  archived: "text-muted-foreground opacity-80",
};

/** Drafts list with the per-row actions: read, copy, archive. */
export function MessagesTable({ rows, total, page, pageSize, filtered }: MessagesTableProps) {
  const t = useT("messages");
  const tc = useT("common");
  const { dateTime } = useFormatters();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [, setPage] = useQueryState("page", parseAsInteger.withOptions({ shallow: false, history: "push" }));
  const [openRow, setOpenRow] = useState<MessageListRow | null>(null);

  async function archive(row: MessageListRow) {
    const result = await setMessageStatusAction({ messageId: row.id, status: "archived" });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(t("toast.archived"));
    startTransition(() => router.refresh());
  }

  const columns: Array<DataTableColumn<MessageListRow>> = [
    {
      key: "business",
      header: t("list.columns.business"),
      cell: (row) => (
        <Link href={`/businesses/${row.businessId}`} className="font-medium underline-offset-4 hover:underline">
          {row.businessName ?? <span className="text-muted-foreground italic">{t("list.unknownBusiness")}</span>}
        </Link>
      ),
    },
    {
      key: "channel",
      header: t("list.columns.channel"),
      cell: (row) => <Badge variant="outline">{tc(`channel.${row.channel}`)}</Badge>,
    },
    {
      key: "status",
      header: t("list.columns.status"),
      cell: (row) => (
        <Badge variant="outline" className={cn(statusTone[row.status])}>
          {t(`status.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: "service",
      header: t("list.columns.service"),
      cell: (row) => row.serviceName ?? <span className="text-muted-foreground">{t("list.noService")}</span>,
    },
    {
      key: "created",
      header: t("list.columns.created"),
      cell: (row) => <span className="whitespace-nowrap text-muted-foreground tabular-nums">{dateTime(row.createdAt)}</span>,
    },
    {
      key: "preview",
      header: t("list.columns.preview"),
      cell: (row) => <span className="line-clamp-2 max-w-md text-muted-foreground">{row.subject ? `${row.subject} — ${row.body}` : row.body}</span>,
      className: "min-w-64",
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("list.columns.actions")}</span>,
      align: "end",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={t("list.actions.open")} onClick={() => setOpenRow(row)}>
            <Eye />
          </Button>
          <CopyButton value={clipboardText(row)} />
          {row.status === "archived" ? null : (
            <ConfirmDialog
              title={t("list.archiveConfirm.title")}
              description={t("list.archiveConfirm.description")}
              confirmLabel={t("list.archiveConfirm.confirm")}
              onConfirm={() => archive(row)}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={t("list.actions.archive")} disabled={pending}>
                  <Archive />
                </Button>
              }
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyState={
          <EmptyState
            bordered={false}
            icon={<PenLine className="size-5" />}
            title={filtered ? t("list.noResults.title") : t("list.empty.title")}
            description={filtered ? t("list.noResults.description") : t("list.empty.description")}
            action={
              filtered ? null : (
                <Button variant="outline" render={<Link href="/opportunities" />}>
                  {t("list.empty.action")}
                </Button>
              )
            }
          />
        }
      />

      {total > pageSize ? (
        <PaginationControls page={page} pageSize={pageSize} total={total} onChange={(next) => void setPage(next <= 1 ? null : next)} />
      ) : null}

      <Dialog open={openRow !== null} onOpenChange={(open) => setOpenRow(open ? openRow : null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("list.dialog.title")}</DialogTitle>
            <DialogDescription>{openRow?.businessName ?? t("list.unknownBusiness")}</DialogDescription>
          </DialogHeader>
          {openRow ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{tc(`channel.${openRow.channel}`)}</Badge>
                <Badge variant="outline" className={cn(statusTone[openRow.status])}>
                  {t(`status.${openRow.status}`)}
                </Badge>
              </div>
              {openRow.subject ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("list.dialog.subject")}</p>
                  <p className="font-medium">{openRow.subject}</p>
                </div>
              ) : null}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("list.dialog.body")}</p>
                <p className="max-h-72 overflow-y-auto rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap">{openRow.body}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton value={clipboardText(openRow)} withLabel variant="outline" />
                <Button variant="outline" render={<Link href={`/businesses/${openRow.businessId}`} />}>
                  <Building2 />
                  {t("list.actions.viewBusiness")}
                </Button>
                <Button variant="outline" render={<Link href={`/messages/new?businessId=${openRow.businessId}`} />}>
                  <PenLine />
                  {t("list.actions.newForBusiness")}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function clipboardText(row: MessageListRow): string {
  return row.subject ? `${row.subject}\n\n${row.body}` : row.body;
}
