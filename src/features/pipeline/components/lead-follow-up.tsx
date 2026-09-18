"use client";

import { AlarmClock, BellOff, BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { InlineAlert } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { setLeadFollowUp } from "@/features/pipeline/actions";
import { useT } from "@/lib/i18n/client";

export interface LeadFollowUpProps {
  leadId: string;
  /** Pre-formatted on the server; null when no reminder is set. */
  currentLabel: string | null;
  due: boolean;
}

/**
 * Follow-up reminders.
 *
 * The MVP never sends anything: the date puts the lead on the dashboard's
 * "due" list and nothing else. The copy says so next to the control, not only
 * in the docs.
 */
export function LeadFollowUp({ leadId, currentLabel, due }: LeadFollowUpProps) {
  const t = useT("pipeline");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);

  function save() {
    if (value.trim() === "") {
      setError(true);
      return;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      setError(true);
      return;
    }
    setError(false);
    submit(parsed.toISOString(), t("followUp.saved"));
  }

  function clear() {
    submit(null, t("followUp.cleared"));
  }

  function submit(nextFollowUpAt: string | null, successMessage: string) {
    startTransition(async () => {
      const result = await setLeadFollowUp({
        leadId,
        nextFollowUpAt,
        note: note.trim() === "" ? null : note.trim(),
      });

      if (!result.ok) {
        toast.error(t("followUp.error"), { description: result.error.message });
        return;
      }
      setValue("");
      setNote("");
      toast.success(successMessage);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <InlineAlert tone="info" icon={<AlarmClock className="size-4 text-sky-600 dark:text-sky-400" />}>
        {t("followUp.description")}
      </InlineAlert>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("followUp.title")}</span>
        {currentLabel ? (
          <Badge variant="outline" className={due ? "border-amber-600/25 bg-amber-500/14 text-amber-700 dark:border-amber-400/25 dark:text-amber-300" : undefined}>
            {currentLabel} · {due ? t("followUp.due") : t("followUp.upcoming")}
          </Badge>
        ) : (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {t("followUp.none")}
          </Badge>
        )}
      </div>

      <Field data-invalid={error || undefined}>
        <FieldLabel htmlFor="lead-follow-up">{t("followUp.label")}</FieldLabel>
        <Input
          id="lead-follow-up"
          type="datetime-local"
          value={value}
          aria-invalid={error || undefined}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(false);
          }}
        />
        {error ? <FieldError>{t("followUp.required")}</FieldError> : null}
      </Field>

      <Field>
        <FieldLabel htmlFor="lead-follow-up-note">{t("followUp.note")}</FieldLabel>
        <Textarea
          id="lead-follow-up-note"
          rows={2}
          maxLength={500}
          value={note}
          placeholder={t("followUp.notePlaceholder")}
          onChange={(event) => setNote(event.target.value)}
        />
        <FieldDescription>{t("notes.title")}</FieldDescription>
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={pending}>
          {pending ? <Spinner /> : <BellRing />}
          {t("followUp.set")}
        </Button>
        {currentLabel ? (
          <Button variant="outline" onClick={clear} disabled={pending}>
            <BellOff />
            {t("followUp.clear")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
