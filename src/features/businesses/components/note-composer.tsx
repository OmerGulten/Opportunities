"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useRowMutation } from "@/features/opportunities/components/use-row-mutation";
import { useT } from "@/lib/i18n/client";

import { revalidateBusinessDetail } from "../actions";
import { requestAddNote } from "./api-client";

export interface NoteComposerProps {
  businessId: string;
  leadId: string;
}

const MAX_LENGTH = 4000;

/** Appends a note to the lead through POST /api/leads/notes. */
export function NoteComposer({ businessId, leadId }: NoteComposerProps) {
  const t = useT("businesses");
  const { pending, run } = useRowMutation();
  const [body, setBody] = useState("");

  async function submit() {
    const value = body.trim();
    if (value.length === 0) return;
    const ok = await run(() => requestAddNote(leadId, value), t("detail.toast.noteAdded"), () => revalidateBusinessDetail(businessId));
    if (ok) setBody("");
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t("detail.notes.placeholder")}
        aria-label={t("detail.notes.placeholder")}
        maxLength={MAX_LENGTH}
        rows={3}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending || body.trim().length === 0}>
          {pending ? <Spinner /> : <Plus />}
          {t("detail.notes.add")}
        </Button>
      </div>
    </form>
  );
}
