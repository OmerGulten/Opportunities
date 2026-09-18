"use client";

import { Eye, EyeOff, PenLine, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";

import { ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useRowMutation } from "@/features/opportunities/components/use-row-mutation";
import { useT } from "@/lib/i18n/client";

import { revalidateBusinessDetail } from "../actions";
import { requestAddToPipeline, requestRefreshAudit, requestSetIgnored } from "./api-client";

export interface BusinessDetailActionsProps {
  businessId: string;
  isIgnored: boolean;
  inPipeline: boolean;
  primaryServiceId: string | null;
}

/**
 * Profile-level actions. Each one calls the route handler that owns it, then
 * asks the server to re-render this page.
 */
export function BusinessDetailActions({ businessId, isIgnored, inPipeline, primaryServiceId }: BusinessDetailActionsProps) {
  const t = useT("businesses");
  const { pending, run } = useRowMutation();
  const revalidate = () => revalidateBusinessDetail(businessId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending ? <Spinner className="size-4 text-muted-foreground" /> : null}

      <Button size="sm" render={<Link href={`/messages/new?businessId=${businessId}`} />}>
        <PenLine />
        {t("detail.actions.writeMessage")}
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={inPipeline || pending}
        onClick={() => void run(() => requestAddToPipeline(businessId, primaryServiceId), t("detail.toast.addedToPipeline"), revalidate)}
      >
        <Plus />
        {inPipeline ? t("detail.actions.inPipeline") : t("detail.actions.addToPipeline")}
      </Button>

      <ConfirmDialog
        title={t("detail.actions.confirmRefreshTitle")}
        description={t("detail.actions.confirmRefreshDescription")}
        confirmLabel={t("detail.actions.refreshAudit")}
        onConfirm={async () => {
          await run(() => requestRefreshAudit(businessId), t("detail.toast.auditQueued"), revalidate);
        }}
        trigger={
          <Button variant="outline" size="sm" disabled={pending}>
            <RefreshCw />
            {t("detail.actions.refreshAudit")}
          </Button>
        }
      />

      {isIgnored ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => void run(() => requestSetIgnored(businessId, false), t("detail.toast.unignored"), revalidate)}
        >
          <Eye />
          {t("detail.actions.unignore")}
        </Button>
      ) : (
        <ConfirmDialog
          title={t("detail.actions.confirmIgnoreTitle")}
          description={t("detail.actions.confirmIgnoreDescription")}
          confirmLabel={t("detail.actions.ignore")}
          destructive
          onConfirm={async () => {
            await run(() => requestSetIgnored(businessId, true), t("detail.toast.ignored"), revalidate);
          }}
          trigger={
            <Button variant="outline" size="sm" disabled={pending}>
              <EyeOff />
              {t("detail.actions.ignore")}
            </Button>
          }
        />
      )}
    </div>
  );
}
