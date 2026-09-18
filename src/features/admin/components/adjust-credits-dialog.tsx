"use client";

import { Coins } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { InlineAlert } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { adjustWorkspaceCreditsAction } from "@/features/admin/actions";
import { useFormatters, useT } from "@/lib/i18n/client";

type Direction = "credit" | "debit";

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 1_000_000;
const MIN_REASON = 3;

export interface AdjustCreditsDialogProps {
  workspaceId: string;
  workspaceName: string;
  /** Current available balance, shown so the operator adjusts against a real number. */
  balance: number;
  /** The account is not billed: the entry is still written, but no balance moves. */
  unlimited?: boolean;
}

/**
 * Grants or removes credits for one workspace.
 *
 * The reason is required by `grantCreditsSchema` and is stored on the ledger
 * entry, so an adjustment is always attributable. Validation is mirrored here
 * only to give immediate feedback; the server re-validates everything.
 */
export function AdjustCreditsDialog({ workspaceId, workspaceName, balance, unlimited = false }: AdjustCreditsDialogProps) {
  const t = useT("admin");
  const tc = useT("common");
  const { number } = useFormatters();

  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function reset() {
    setDirection("credit");
    setAmount("");
    setReason("");
    setAmountError(null);
    setReasonError(null);
    setFormError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsedAmount = Number(amount);
    const amountValid = Number.isInteger(parsedAmount) && parsedAmount >= MIN_AMOUNT && parsedAmount <= MAX_AMOUNT;
    const reasonValid = reason.trim().length >= MIN_REASON;
    setAmountError(amountValid ? null : t("credits.errors.amount"));
    setReasonError(reasonValid ? null : t("credits.errors.reason"));
    if (!amountValid || !reasonValid) return;

    setPending(true);
    const result = await adjustWorkspaceCreditsAction({
      workspaceId,
      amount: parsedAmount,
      direction,
      reason: reason.trim(),
    });
    setPending(false);

    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }

    toast.success(
      direction === "credit"
        ? t("credits.successCredit", { amount: number(result.data.amount) })
        : t("credits.successDebit", { amount: number(result.data.amount) }),
    );
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Coins />
        {t("workspaces.adjustCredits")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("credits.dialogTitle", { workspace: workspaceName })}</DialogTitle>
          <DialogDescription>{t("credits.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <form id={`adjust-credits-${workspaceId}`} onSubmit={handleSubmit}>
          <FieldGroup>
            {unlimited ? (
              <InlineAlert tone="neutral" title={t("credits.unlimitedTitle")}>
                {t("credits.unlimitedBody")}
              </InlineAlert>
            ) : null}

            <Field>
              <FieldLabel htmlFor={`direction-${workspaceId}`}>{t("credits.direction")}</FieldLabel>
              <Select
                value={direction}
                onValueChange={(value) => {
                  if (value === "credit" || value === "debit") setDirection(value);
                }}
              >
                <SelectTrigger id={`direction-${workspaceId}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">{t("credits.directionCredit")}</SelectItem>
                  <SelectItem value="debit">{t("credits.directionDebit")}</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>{t("credits.currentBalance", { balance: number(balance) })}</FieldDescription>
            </Field>

            <Field data-invalid={amountError ? true : undefined}>
              <FieldLabel htmlFor={`amount-${workspaceId}`}>{t("credits.amount")}</FieldLabel>
              <Input
                id={`amount-${workspaceId}`}
                name="amount"
                type="number"
                inputMode="numeric"
                min={MIN_AMOUNT}
                max={MAX_AMOUNT}
                step={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={amountError ? true : undefined}
                required
              />
              <FieldDescription>{t("credits.amountHint")}</FieldDescription>
              <FieldError>{amountError}</FieldError>
            </Field>

            <Field data-invalid={reasonError ? true : undefined}>
              <FieldLabel htmlFor={`reason-${workspaceId}`}>{t("credits.reason")}</FieldLabel>
              <Textarea
                id={`reason-${workspaceId}`}
                name="reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t("credits.reasonPlaceholder")}
                aria-invalid={reasonError ? true : undefined}
                required
              />
              <FieldDescription>{t("credits.reasonHint")}</FieldDescription>
              <FieldError>{reasonError}</FieldError>
            </Field>

            {formError ? <InlineAlert tone="negative">{formError}</InlineAlert> : null}
          </FieldGroup>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>{tc("actions.cancel")}</DialogClose>
          <Button type="submit" form={`adjust-credits-${workspaceId}`} disabled={pending}>
            {pending ? <Spinner /> : null}
            {t("credits.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
