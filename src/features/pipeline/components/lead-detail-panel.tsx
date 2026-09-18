"use client";

import { CalendarCheck, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { deleteLead, saveLead } from "@/features/pipeline/actions";
import { useT } from "@/lib/i18n/client";

import type { PipelineOwnerModel, PipelineStageModel } from "./types";

const CURRENCIES = ["TRY", "USD", "EUR"];
const UNASSIGNED = "unassigned";

export interface LeadDetailPanelProps {
  leadId: string;
  stages: PipelineStageModel[];
  owners: PipelineOwnerModel[];
  initial: {
    stageId: string;
    ownerId: string | null;
    estimatedValue: number | null;
    wonValue: number | null;
    currency: string;
    lossReason: string | null;
  };
}

/** Empty clears the amount; anything that is not a plain 0-100M number is refused. */
function parseAmount(value: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, value: null };
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000_000) return { ok: false };
  return { ok: true, value: parsed };
}

/**
 * Stage, ownership and the amounts the user maintains by hand.
 *
 * The amounts are the user's own numbers: no figure on this page is predicted,
 * projected or derived from a likelihood model.
 */
export function LeadDetailPanel({ leadId, stages, owners, initial }: LeadDetailPanelProps) {
  const t = useT("pipeline");
  const tc = useT("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [stageId, setStageId] = useState(initial.stageId);
  const [ownerId, setOwnerId] = useState(initial.ownerId ?? UNASSIGNED);
  const [estimatedValue, setEstimatedValue] = useState(initial.estimatedValue === null ? "" : String(initial.estimatedValue));
  const [wonValue, setWonValue] = useState(initial.wonValue === null ? "" : String(initial.wonValue));
  const [currencyCode, setCurrencyCode] = useState(initial.currency);
  const [lossReason, setLossReason] = useState(initial.lossReason ?? "");
  const [lossError, setLossError] = useState(false);
  const [amountError, setAmountError] = useState<"estimated" | "won" | null>(null);

  const selectedStage = stages.find((stage) => stage.id === stageId);
  const lossRequired = Boolean(selectedStage?.isLost);

  function submit(extra?: { lastContactedAt?: string }) {
    const reason = lossReason.trim();
    if (lossRequired && reason === "") {
      setLossError(true);
      return;
    }
    setLossError(false);

    const estimated = parseAmount(estimatedValue);
    const won = parseAmount(wonValue);
    if (!estimated.ok || !won.ok) {
      setAmountError(!estimated.ok ? "estimated" : "won");
      return;
    }
    setAmountError(null);

    startTransition(async () => {
      const result = await saveLead(leadId, {
        stageId,
        ownerId: ownerId === UNASSIGNED ? null : ownerId,
        estimatedValue: estimated.value,
        wonValue: won.value,
        currency: currencyCode,
        lossReason: reason === "" ? null : reason,
        ...(extra?.lastContactedAt ? { lastContactedAt: extra.lastContactedAt } : {}),
      });

      if (!result.ok) {
        toast.error(t("detail.saveError"), { description: result.error.message });
        return;
      }
      toast.success(t("detail.saved"));
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteLead(leadId);
      if (!result.ok) {
        toast.error(t("detail.removeError"), { description: result.error.message });
        return;
      }
      toast.success(t("detail.removed"));
      router.push("/pipeline");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="lead-stage">{t("detail.stage")}</FieldLabel>
          <Select
            value={stageId}
            onValueChange={(value) => {
              if (typeof value === "string") setStageId(value);
            }}
          >
            <SelectTrigger id="lead-stage" className="w-full">
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
        </Field>

        <Field>
          <FieldLabel htmlFor="lead-owner">{t("detail.owner")}</FieldLabel>
          <Select
            value={ownerId}
            onValueChange={(value) => {
              if (typeof value === "string") setOwnerId(value);
            }}
          >
            <SelectTrigger id="lead-owner" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>{t("filters.unassigned")}</SelectItem>
              {owners.map((owner) => (
                <SelectItem key={owner.id} value={owner.id}>
                  {owner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field data-invalid={amountError === "estimated" || undefined}>
          <FieldLabel htmlFor="lead-estimated">{t("detail.estimatedValue")}</FieldLabel>
          <Input
            id="lead-estimated"
            inputMode="decimal"
            value={estimatedValue}
            aria-invalid={amountError === "estimated" || undefined}
            onChange={(event) => {
              setEstimatedValue(event.target.value);
              if (amountError === "estimated") setAmountError(null);
            }}
            placeholder="0"
          />
          {amountError === "estimated" ? <FieldError>{t("detail.amountInvalid")}</FieldError> : <FieldDescription>{t("detail.estimatedValueHint")}</FieldDescription>}
        </Field>

        <Field data-invalid={amountError === "won" || undefined}>
          <FieldLabel htmlFor="lead-won">{t("detail.wonValue")}</FieldLabel>
          <Input
            id="lead-won"
            inputMode="decimal"
            value={wonValue}
            aria-invalid={amountError === "won" || undefined}
            onChange={(event) => {
              setWonValue(event.target.value);
              if (amountError === "won") setAmountError(null);
            }}
            placeholder="0"
          />
          {amountError === "won" ? <FieldError>{t("detail.amountInvalid")}</FieldError> : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="lead-currency">{t("detail.currency")}</FieldLabel>
          <Select
            value={currencyCode}
            onValueChange={(value) => {
              if (typeof value === "string") setCurrencyCode(value);
            }}
          >
            <SelectTrigger id="lead-currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field data-invalid={lossError || undefined}>
        <FieldLabel htmlFor="lead-loss-reason">{t("detail.lossReason")}</FieldLabel>
        <Textarea
          id="lead-loss-reason"
          rows={2}
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

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => submit()} disabled={pending}>
          {pending ? <Spinner /> : <Save />}
          {t("detail.save")}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => submit({ lastContactedAt: new Date().toISOString() })}>
          <CalendarCheck />
          {t("detail.markContactedNow")}
        </Button>
        <ConfirmDialog
          title={t("detail.removeTitle")}
          description={t("detail.removeDescription")}
          confirmLabel={t("detail.remove")}
          cancelLabel={tc("actions.cancel")}
          destructive
          onConfirm={remove}
          trigger={
            <Button variant="destructive" disabled={pending}>
              <Trash2 />
              {t("detail.remove")}
            </Button>
          }
        />
      </div>
    </div>
  );
}
