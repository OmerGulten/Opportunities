"use client";

import { EllipsisVertical, Eye, EyeOff, PenLine, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { requestAddToPipeline, requestRefreshAudit, requestSetIgnored } from "@/features/businesses/components/api-client";
import { useT } from "@/lib/i18n/client";

import { revalidateOpportunityLists } from "../actions";
import { useRowMutation } from "./use-row-mutation";

export interface BusinessRowActionsProps {
  businessId: string;
  isIgnored: boolean;
  /** Whether a lead already exists, so the row does not offer a duplicate. */
  inPipeline: boolean;
  primaryServiceId: string | null;
}

/** Per-row actions. Every mutation goes through the existing API routes. */
export function BusinessRowActions({ businessId, isIgnored, inPipeline, primaryServiceId }: BusinessRowActionsProps) {
  const t = useT("opportunities");
  const { pending, run } = useRowMutation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={t("actions.menu")} disabled={pending}>
            <EllipsisVertical />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem render={<Link href={`/businesses/${businessId}`} />}>
          <Eye />
          {t("actions.view")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/messages/new?businessId=${businessId}`} />}>
          <PenLine />
          {t("actions.writeMessage")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={inPipeline || pending}
          onClick={() =>
            void run(() => requestAddToPipeline(businessId, primaryServiceId), t("toast.addedToPipeline"), revalidateOpportunityLists)
          }
        >
          <Plus />
          {inPipeline ? t("actions.inPipeline") : t("actions.addToPipeline")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={pending}
          onClick={() => void run(() => requestRefreshAudit(businessId), t("toast.auditQueued"), revalidateOpportunityLists)}
        >
          <RefreshCw />
          {t("actions.refreshAudit")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant={isIgnored ? "default" : "destructive"}
          disabled={pending}
          onClick={() =>
            void run(
              () => requestSetIgnored(businessId, !isIgnored),
              isIgnored ? t("toast.unignored") : t("toast.ignored"),
              revalidateOpportunityLists,
            )
          }
        >
          {isIgnored ? <Eye /> : <EyeOff />}
          {isIgnored ? t("actions.unignore") : t("actions.ignore")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
