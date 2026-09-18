"use client";

import { cn } from "cn";
import { AlarmClock, CalendarCheck, GripVertical, User, Wallet } from "lucide-react";
import Link from "next/link";

import { ScoreBadge, ServiceBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFormatters, useT } from "@/lib/i18n/client";

import type { PipelineLeadModel, PipelineStageModel } from "./types";

export interface LeadCardProps {
  lead: PipelineLeadModel;
  /** Stage the card is currently drawn in (may be an optimistic value). */
  stageId: string;
  stages: PipelineStageModel[];
  onMove: (stageId: string) => void;
  dragging: boolean;
  pending: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

/**
 * One lead on the board. Draggable for mouse users and movable through the
 * stage select for everyone else; both paths call the same `onMove`.
 */
export function LeadCard({ lead, stageId, stages, onMove, dragging, pending, onDragStart, onDragEnd }: LeadCardProps) {
  const t = useT("pipeline");
  const { currency } = useFormatters();
  const location = [lead.district, lead.city].filter(Boolean).join(", ");

  return (
    <article
      draggable
      aria-label={lead.businessName ?? lead.businessId}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", lead.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group/lead flex cursor-grab flex-col gap-2 rounded-xl bg-card p-3 text-sm ring-1 ring-foreground/10 transition-shadow",
        "hover:ring-foreground/20 focus-within:ring-ring/50",
        dragging && "opacity-50",
        pending && "animate-pulse",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/pipeline/${lead.id}`}
            className="line-clamp-2 font-medium text-foreground outline-none hover:underline focus-visible:underline"
          >
            {lead.businessName ?? lead.businessId}
          </Link>
          {location ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{location}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ScoreBadge score={lead.overallScore} size="sm" />
          <GripVertical className="size-3.5 text-muted-foreground/60" aria-hidden />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {lead.primaryServiceName ? (
          <ServiceBadge name={lead.primaryServiceName} icon={lead.primaryServiceIcon} className="h-5 text-[0.7rem]" />
        ) : (
          <span className="text-xs text-muted-foreground">{t("card.noService")}</span>
        )}
        {lead.status !== "open" ? (
          <Badge variant="outline" className="h-5 text-[0.7rem] font-normal">
            {t(`status.${lead.status}`)}
          </Badge>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{t("card.estimatedValue")}</dt>
          <Wallet className="size-3.5 shrink-0" aria-hidden />
          <dd className="tabular-nums">{lead.estimatedValue === null ? t("card.noEstimate") : currency(lead.estimatedValue, lead.currency)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{t("card.owner")}</dt>
          <User className="size-3.5 shrink-0" aria-hidden />
          <dd className="truncate">{lead.ownerName ?? t("card.unassigned")}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{t("card.nextFollowUp")}</dt>
          <AlarmClock className={cn("size-3.5 shrink-0", lead.followUpDue && "text-amber-600 dark:text-amber-400")} aria-hidden />
          <dd className={cn("tabular-nums", lead.followUpDue && "text-amber-700 dark:text-amber-300")}>
            {lead.nextFollowUpLabel ?? t("card.noFollowUp")}
            {lead.followUpDue ? <span className="ml-1 font-medium">· {t("card.overdue")}</span> : null}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{t("card.lastContact")}</dt>
          <CalendarCheck className="size-3.5 shrink-0" aria-hidden />
          <dd className="tabular-nums">{lead.lastContactedLabel ?? t("card.neverContacted")}</dd>
        </div>
      </dl>

      {/* Keyboard- and screen-reader-friendly equivalent of dragging the card. */}
      <div onDragStart={(event) => event.preventDefault()} className="pt-0.5">
        <Select
          value={stageId}
          disabled={pending}
          onValueChange={(value) => {
            if (typeof value === "string" && value !== stageId) onMove(value);
          }}
        >
          <SelectTrigger size="sm" className="w-full" aria-label={t("board.moveTo")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </article>
  );
}
