"use client";

import { EyeOff, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { requestAddToPipeline, requestSetIgnored } from "@/features/businesses/components/api-client";
import { useT } from "@/lib/i18n/client";

import { revalidateOpportunityLists } from "../actions";

export interface BulkTarget {
  id: string;
  inPipeline: boolean;
  isIgnored: boolean;
  primaryServiceId: string | null;
}

export interface BulkActionBarProps {
  targets: BulkTarget[];
  onClear: () => void;
}

/** Runs the operations a few at a time so a large selection cannot flood the API. */
async function runInBatches(items: Array<() => Promise<void>>, size = 5): Promise<{ done: number; failed: number }> {
  let done = 0;
  let failed = 0;
  for (let index = 0; index < items.length; index += size) {
    const results = await Promise.allSettled(items.slice(index, index + size).map((task) => task()));
    for (const result of results) {
      if (result.status === "fulfilled") done += 1;
      else failed += 1;
    }
  }
  return { done, failed };
}

/**
 * Bulk actions for the current selection.
 *
 * Only reversible operations are offered: adding to the pipeline and ignoring,
 * both of which can be undone from the row menu. Nothing here deletes data or
 * spends AI credits.
 */
export function BulkActionBar({ targets, onClear }: BulkActionBarProps) {
  const t = useT("opportunities");
  const [pending, setPending] = useState(false);

  if (targets.length === 0) return null;

  async function addSelectedToPipeline() {
    const candidates = targets.filter((target) => !target.inPipeline);
    const skipped = targets.length - candidates.length;
    setPending(true);
    try {
      const { done, failed } = await runInBatches(candidates.map((target) => () => requestAddToPipeline(target.id, target.primaryServiceId)));
      if (done > 0) toast.success(t("toast.addedToPipelineCount", { count: done }));
      if (skipped > 0) toast.info(t("toast.alreadyInPipeline", { count: skipped }));
      if (failed > 0) toast.error(t("toast.failedCount", { count: failed }));
      await revalidateOpportunityLists();
      onClear();
    } finally {
      setPending(false);
    }
  }

  async function ignoreSelected() {
    const candidates = targets.filter((target) => !target.isIgnored);
    setPending(true);
    try {
      const { done, failed } = await runInBatches(candidates.map((target) => () => requestSetIgnored(target.id, true)));
      if (done > 0) toast.success(t("toast.ignoredCount", { count: done }));
      if (failed > 0) toast.error(t("toast.failedCount", { count: failed }));
      await revalidateOpportunityLists();
      onClear();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <span className="text-sm font-medium">{t("bulk.selected", { count: targets.length })}</span>
      {pending ? <Spinner className="size-4 text-muted-foreground" /> : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <ConfirmDialog
          title={t("bulk.confirmAddTitle")}
          description={t("bulk.confirmAddDescription")}
          confirmLabel={t("bulk.addToPipeline")}
          onConfirm={addSelectedToPipeline}
          trigger={
            <Button variant="outline" size="sm" disabled={pending}>
              <Plus />
              {t("bulk.addToPipeline")}
            </Button>
          }
        />
        <ConfirmDialog
          title={t("bulk.confirmIgnoreTitle")}
          description={t("bulk.confirmIgnoreDescription")}
          confirmLabel={t("bulk.ignore")}
          destructive
          onConfirm={ignoreSelected}
          trigger={
            <Button variant="outline" size="sm" disabled={pending}>
              <EyeOff />
              {t("bulk.ignore")}
            </Button>
          }
        />
        <Button variant="ghost" size="sm" onClick={onClear} disabled={pending}>
          <X />
          {t("bulk.clear")}
        </Button>
      </div>
    </div>
  );
}
