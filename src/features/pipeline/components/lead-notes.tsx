"use client";

import { MessageSquarePlus, StickyNote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createLeadNote } from "@/features/pipeline/actions";
import { useT } from "@/lib/i18n/client";

export interface LeadNoteModel {
  id: string;
  body: string;
  authorName: string | null;
  /** Pre-formatted on the server. */
  createdLabel: string | null;
}

export function LeadNotes({ leadId, notes }: { leadId: string; notes: LeadNoteModel[] }) {
  const t = useT("pipeline");
  const tc = useT("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState(false);

  function add() {
    const trimmed = body.trim();
    if (trimmed === "") {
      setError(true);
      return;
    }
    setError(false);

    startTransition(async () => {
      const result = await createLeadNote({ leadId, body: trimmed });
      if (!result.ok) {
        toast.error(t("notes.error"), { description: result.error.message });
        return;
      }
      setBody("");
      toast.success(t("notes.added"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Field data-invalid={error || undefined}>
        <FieldLabel htmlFor="lead-note">{t("notes.title")}</FieldLabel>
        <Textarea
          id="lead-note"
          rows={3}
          maxLength={4000}
          value={body}
          aria-invalid={error || undefined}
          placeholder={t("notes.placeholder")}
          onChange={(event) => {
            setBody(event.target.value);
            if (error) setError(false);
          }}
        />
        {error ? <FieldError>{t("notes.required")}</FieldError> : null}
      </Field>

      <div>
        <Button onClick={add} disabled={pending}>
          {pending ? <Spinner /> : <MessageSquarePlus />}
          {t("notes.add")}
        </Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState icon={<StickyNote />} title={t("notes.empty")} bordered />
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl bg-card p-3 text-sm ring-1 ring-foreground/10">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {note.authorName ?? tc("states.unknown")}
                {note.createdLabel ? ` · ${note.createdLabel}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
