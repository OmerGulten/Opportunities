"use client";

import { RotateCcw, Square } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cancelScanAction, retryScanAction } from "@/features/scans/actions";
import { useT } from "@/lib/i18n/client";
import { ACTIVE_SCAN_STATUSES, type ScanStatus } from "@/types/common";

const RETRYABLE: readonly ScanStatus[] = ["failed", "cancelled", "partially_completed"];

export function isCancellableStatus(status: ScanStatus): boolean {
  return ACTIVE_SCAN_STATUSES.includes(status);
}

export function isRetryableStatus(status: ScanStatus): boolean {
  return RETRYABLE.includes(status);
}

export interface ScanActionsProps {
  scanId: string;
  scanName: string;
  status: ScanStatus;
  size?: "sm" | "default";
}

/**
 * Cancel / retry for one scan. Both go through server actions so the page
 * re-renders with the new state; failures are reported through the error
 * namespace rather than as raw messages.
 */
export function ScanActions({ scanId, scanName, status, size = "sm" }: ScanActionsProps) {
  const t = useT("scans");
  const te = useT("errors");
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const cancellable = isCancellableStatus(status);
  const retryable = isRetryableStatus(status);
  if (!cancellable && !retryable) return null;

  async function confirmCancel() {
    const result = await cancelScanAction(scanId);
    if (!result.ok) {
      toast.error(te(result.error.code));
      throw new Error(result.error.code);
    }
    toast.success(t("actions.cancelled"));
  }

  function retry() {
    startTransition(async () => {
      const result = await retryScanAction(scanId);
      if (!result.ok) {
        toast.error(te(result.error.code));
        return;
      }
      toast.success(t("actions.retried"));
    });
  }

  return (
    <div className="flex items-center gap-1">
      {cancellable ? (
        <>
          <Button type="button" variant="outline" size={size} onClick={() => setConfirmOpen(true)}>
            <Square />
            {t("actions.cancel")}
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={t("actions.cancelConfirmTitle")}
            description={t("actions.cancelConfirmBody", { name: scanName })}
            confirmLabel={t("actions.cancel")}
            destructive
            onConfirm={confirmCancel}
          />
        </>
      ) : null}
      {retryable ? (
        <Button type="button" variant="outline" size={size} onClick={retry} disabled={pending}>
          {pending ? <Spinner /> : <RotateCcw />}
          {t("actions.retry")}
        </Button>
      ) : null}
    </div>
  );
}
