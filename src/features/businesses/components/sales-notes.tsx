import { getT } from "@/lib/i18n";
import type { Locale } from "@/types/common";
import type { LeadNoteRow } from "@/types/db";

import { NoteComposer } from "./note-composer";
import { formatDateTime } from "./summaries";

export interface SalesNotesProps {
  businessId: string;
  leadId: string | null;
  notes: LeadNoteRow[];
  locale: Locale;
}

/** Team notes on the lead. Notes live on the lead, so one must exist first. */
export function SalesNotes({ businessId, leadId, notes, locale }: SalesNotesProps) {
  const t = getT(locale, "businesses");

  if (!leadId) {
    return <p className="text-sm text-muted-foreground">{t("detail.notes.needsLead")}</p>;
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <NoteComposer businessId={businessId} leadId={leadId} />

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("detail.notes.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2 border-t border-border pt-3">
          {notes.map((note) => (
            <li key={note.id} className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3">
              <p className="text-sm whitespace-pre-wrap">{note.body}</p>
              <span className="text-xs text-muted-foreground">{formatDateTime(note.created_at, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
