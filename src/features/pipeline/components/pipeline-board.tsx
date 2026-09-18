"use client";

import { cn } from "cn";
import { Inbox, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { DataTable, EmptyState, ScoreBadge, ServiceBadge, type DataTableColumn } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFormatters, useT } from "@/lib/i18n/client";

import { readErrorCode } from "./api-error";
import { LeadCard } from "./lead-card";
import { PIPELINE_VIEWS, type PipelineLeadModel, type PipelineStageModel } from "./types";

/** Stable base for useOptimistic: pending moves are layered on top of it. */
const NO_MOVES: Record<string, string> = {};

export interface PipelineBoardProps {
  stages: PipelineStageModel[];
  leads: PipelineLeadModel[];
  /** True when the current URL carries filters, so the empty state can say so. */
  filtered: boolean;
}

/** A lead heading for a stage: both the optimistic action and the loss prompt. */
interface StageMove {
  leadId: string;
  stageId: string;
}

/**
 * Board and list rendering plus stage moves.
 *
 * A move is applied optimistically inside a transition and PATCHed to
 * `/api/leads/:id`. If the request fails the transition ends without a refresh,
 * React discards the optimistic value and the card snaps back to the stage the
 * server still holds.
 */
export function PipelineBoard({ stages, leads, filtered }: PipelineBoardProps) {
  const t = useT("pipeline");
  const tc = useT("common");
  const tErrors = useT("errors");
  const router = useRouter();
  const { currency } = useFormatters();

  const [view] = useQueryState("view", parseAsStringLiteral(PIPELINE_VIEWS).withDefault("board").withOptions({ clearOnDefault: true }));
  const [isPending, startTransition] = useTransition();
  const [moves, applyMove] = useOptimistic(NO_MOVES, (state, move: StageMove) => ({ ...state, [move.leadId]: move.stageId }));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [lossPrompt, setLossPrompt] = useState<StageMove | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [lossError, setLossError] = useState(false);

  const stageOf = (lead: PipelineLeadModel) => moves[lead.id] ?? lead.stageId;

  function commitMove(leadId: string, stageId: string, reason: string | null) {
    const lead = leads.find((item) => item.id === leadId);
    const stage = stages.find((item) => item.id === stageId);

    startTransition(async () => {
      applyMove({ leadId, stageId });
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reason === null ? { stageId } : { stageId, lossReason: reason }),
      });

      if (!response.ok) {
        toast.error(t("move.error"), { description: tErrors(await readErrorCode(response)) });
        return;
      }

      toast.success(t("move.success", { name: lead?.businessName ?? "", stage: stage?.name ?? "" }));
      router.refresh();
    });
  }

  function requestMove(lead: PipelineLeadModel, stageId: string) {
    if (stageId === stageOf(lead)) return;
    const target = stages.find((stage) => stage.id === stageId);
    // A lost stage without a recorded reason is data we will wish we had.
    if (target?.isLost) {
      setLossReason("");
      setLossError(false);
      setLossPrompt({ leadId: lead.id, stageId });
      return;
    }
    commitMove(lead.id, stageId, null);
  }

  function confirmLoss() {
    if (!lossPrompt) return;
    const reason = lossReason.trim();
    if (!reason) {
      setLossError(true);
      return;
    }
    commitMove(lossPrompt.leadId, lossPrompt.stageId, reason);
    setLossPrompt(null);
  }

  function handleDrop(stageId: string) {
    setDragOverStageId(null);
    const leadId = draggingId;
    setDraggingId(null);
    if (!leadId) return;
    const lead = leads.find((item) => item.id === leadId);
    if (lead) requestMove(lead, stageId);
  }

  if (stages.length === 0) {
    return <EmptyState icon={<Inbox />} title={t("board.noStages")} description={t("board.noStagesDescription")} />;
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={<Target />}
        title={filtered ? t("empty.filteredTitle") : t("empty.title")}
        description={filtered ? t("empty.filteredDescription") : t("empty.description")}
        action={
          filtered ? (
            <Button variant="outline" render={<Link href="/pipeline" />}>
              {t("filters.clear")}
            </Button>
          ) : (
            <Button render={<Link href="/opportunities" />}>{t("empty.action")}</Button>
          )
        }
      />
    );
  }

  const listColumns: Array<DataTableColumn<PipelineLeadModel>> = [
    {
      key: "business",
      header: t("list.business"),
      cell: (lead) => (
        <div className="min-w-0">
          <Link href={`/pipeline/${lead.id}`} className="font-medium hover:underline">
            {lead.businessName ?? lead.businessId}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {[lead.district, lead.city].filter(Boolean).join(", ") || tc("states.unknown")}
          </p>
        </div>
      ),
      className: "min-w-52",
    },
    { key: "score", header: t("list.score"), cell: (lead) => <ScoreBadge score={lead.overallScore} size="sm" />, align: "center" },
    {
      key: "service",
      header: t("list.service"),
      cell: (lead) =>
        lead.primaryServiceName ? (
          <ServiceBadge name={lead.primaryServiceName} icon={lead.primaryServiceIcon} className="h-5 text-[0.7rem]" />
        ) : (
          <span className="text-xs text-muted-foreground">{t("card.noService")}</span>
        ),
    },
    {
      key: "stage",
      header: t("list.stage"),
      cell: (lead) => (
        <Select
          value={stageOf(lead)}
          disabled={isPending}
          onValueChange={(value) => {
            if (typeof value === "string") requestMove(lead, value);
          }}
        >
          <SelectTrigger size="sm" className="w-36" aria-label={t("board.moveTo")}>
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
      ),
    },
    {
      key: "status",
      header: t("list.status"),
      cell: (lead) => (
        <Badge variant="outline" className="h-5 text-[0.7rem] font-normal">
          {t(`status.${lead.status}`)}
        </Badge>
      ),
    },
    { key: "owner", header: t("list.owner"), cell: (lead) => <span className="text-sm">{lead.ownerName ?? t("card.unassigned")}</span> },
    {
      key: "value",
      header: t("list.value"),
      align: "end",
      cell: (lead) => (
        <span className="tabular-nums">{lead.estimatedValue === null ? <span className="text-muted-foreground">—</span> : currency(lead.estimatedValue, lead.currency)}</span>
      ),
    },
    {
      key: "followUp",
      header: t("list.followUp"),
      cell: (lead) =>
        lead.nextFollowUpLabel ? (
          <span className={cn("tabular-nums", lead.followUpDue && "text-amber-700 dark:text-amber-300")}>
            {lead.nextFollowUpLabel}
            {lead.followUpDue ? ` · ${t("card.overdue")}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">{t("followUp.none")}</span>
        ),
    },
    {
      key: "lastContact",
      header: t("list.lastContact"),
      cell: (lead) =>
        lead.lastContactedLabel ? (
          <span className="tabular-nums">{lead.lastContactedLabel}</span>
        ) : (
          <span className="text-muted-foreground">{t("card.neverContacted")}</span>
        ),
    },
  ];

  return (
    <>
      {view === "list" ? (
        <DataTable columns={listColumns} rows={leads} rowKey={(lead) => lead.id} />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {stages.map((stage) => {
            const stageLeads = leads.filter((lead) => stageOf(lead) === stage.id);
            const total = stageLeads.reduce((sum, lead) => sum + (lead.estimatedValue ?? 0), 0);
            const stageCurrency = stageLeads[0]?.currency ?? "TRY";

            return (
              <section
                key={stage.id}
                aria-label={t("board.stageColumn", { stage: stage.name })}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dragOverStageId !== stage.id) setDragOverStageId(stage.id);
                }}
                onDragLeave={() => setDragOverStageId((current) => (current === stage.id ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(stage.id);
                }}
                className={cn(
                  "flex w-72 shrink-0 flex-col gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-inset transition-colors",
                  dragOverStageId === stage.id ? "bg-primary/5 ring-primary/40" : "ring-foreground/5",
                )}
              >
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 truncate font-heading text-sm font-medium">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: stage.color ?? "var(--muted-foreground)" }}
                      />
                      {stage.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {t("board.count", { count: stageLeads.length })}
                      {total > 0 ? ` · ${currency(total, stageCurrency)}` : ""}
                    </p>
                  </div>
                </header>

                <div className="flex flex-col gap-2">
                  {stageLeads.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      {dragOverStageId === stage.id ? t("board.dropHere") : t("board.emptyColumn")}
                    </p>
                  ) : (
                    stageLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        stageId={stage.id}
                        stages={stages}
                        dragging={draggingId === lead.id}
                        pending={isPending && moves[lead.id] !== undefined}
                        onDragStart={() => setDraggingId(lead.id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverStageId(null);
                        }}
                        onMove={(stageId) => requestMove(lead, stageId)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {isPending ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <Spinner className="size-3.5" aria-label={t("move.moving")} />
          {t("move.moving")}
        </p>
      ) : null}

      <Dialog
        open={lossPrompt !== null}
        onOpenChange={(open) => {
          if (!open) setLossPrompt(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("move.lossTitle")}</DialogTitle>
            <DialogDescription>{t("move.lossDescription")}</DialogDescription>
          </DialogHeader>
          <Field data-invalid={lossError || undefined}>
            <FieldLabel htmlFor="pipeline-loss-reason">{t("move.lossLabel")}</FieldLabel>
            <Textarea
              id="pipeline-loss-reason"
              rows={3}
              maxLength={500}
              value={lossReason}
              aria-invalid={lossError || undefined}
              placeholder={t("move.lossPlaceholder")}
              onChange={(event) => {
                setLossReason(event.target.value);
                if (lossError) setLossError(false);
              }}
            />
            {lossError ? <FieldError>{t("move.lossRequired")}</FieldError> : <FieldDescription>{t("detail.lossReasonHint")}</FieldDescription>}
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLossPrompt(null)}>
              {tc("actions.cancel")}
            </Button>
            <Button onClick={confirmLoss}>{t("move.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
