"use client";

import { ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/client";

const MIN_REASON = 3;

export interface UnlimitedBillingDialogProps {
  workspaceId: string;
  workspaceName: string;
  /** Current state of `credit_accounts.unlimited`, so the dialog offers the opposite. */
  unlimited: boolean;
}

/**
 * Turns credit billing off (or back on) for one workspace.
 *
 * The switch changes billing only: operations are still recorded with their real
 * quantity, so the usage figures next to it stay true. The reason is required by
 * `setUnlimitedSchema` and is stored on the `billing_events` row, so free usage
 * is always attributable. Validation is mirrored here for immediate feedback;
 * the server re-validates and re-checks platform-admin rights.
 */
export function UnlimitedBillingDialog({ workspaceId, workspaceName, unlimited }: UnlimitedBillingDialogProps) {
  const t = useT("admin");
  const tc = useT("common");
  const te = useT("errors");
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // The dialog always proposes the opposite of the state the row was rendered with.
  const next = !unlimited;

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setReason("");
      setReasonError(null);
      setFormError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON) {
      setReasonError(t("unlimited.errors.reason"));
      return;
    }
    setReasonError(null);

    setPending(true);
    try {
      const response = await fetch("/api/admin/unlimited", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId, unlimited: next, reason: trimmed }),
      });
      const payload = (await response.json()) as { error?: { code?: string } };
      if (!response.ok) {
        const code = payload.error?.code ?? "internal_error";
        setFormError(te(code));
        return;
      }
      toast.success(next ? t("unlimited.successOn", { workspace: workspaceName }) : t("unlimited.successOff", { workspace: workspaceName }));
      handleOpenChange(false);
      router.refresh();
    } catch {
      setFormError(te("internal_error"));
    } finally {
      setPending(false);
    }
  }

  const formId = `unlimited-billing-${workspaceId}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <ReceiptText />
        {t("unlimited.trigger")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {next ? t("unlimited.dialogTitleOn", { workspace: workspaceName }) : t("unlimited.dialogTitleOff", { workspace: workspaceName })}
          </DialogTitle>
          <DialogDescription>{next ? t("unlimited.dialogDescriptionOn") : t("unlimited.dialogDescriptionOff")}</DialogDescription>
        </DialogHeader>

        <form id={formId} onSubmit={handleSubmit}>
          <FieldGroup>
            <InlineAlert tone="neutral" title={t("unlimited.scopeTitle")}>
              {t("unlimited.scopeBody")}
            </InlineAlert>

            <Field data-invalid={reasonError ? true : undefined}>
              <FieldLabel htmlFor={`unlimited-reason-${workspaceId}`}>{t("unlimited.reason")}</FieldLabel>
              <Textarea
                id={`unlimited-reason-${workspaceId}`}
                name="reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={next ? t("unlimited.reasonPlaceholderOn") : t("unlimited.reasonPlaceholderOff")}
                aria-invalid={reasonError ? true : undefined}
                required
              />
              <FieldDescription>{t("unlimited.reasonHint")}</FieldDescription>
              <FieldError>{reasonError}</FieldError>
            </Field>

            {formError ? <InlineAlert tone="negative">{formError}</InlineAlert> : null}
          </FieldGroup>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>{tc("actions.cancel")}</DialogClose>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? <Spinner /> : null}
            {next ? t("unlimited.submitOn") : t("unlimited.submitOff")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
