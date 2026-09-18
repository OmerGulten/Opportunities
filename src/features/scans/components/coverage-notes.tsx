"use client";

import { cn } from "cn";
import { Info } from "lucide-react";

import { useT } from "@/lib/i18n/client";

export interface CoverageNotesProps {
  /** Raw note codes from the planner: `code` or `code:key=value,key=value`. */
  notes: string[];
  className?: string;
}

interface ParsedNote {
  code: string;
  params: Record<string, string>;
}

/**
 * Renders the coverage planner's notes.
 *
 * The planner emits machine-readable codes (`COVERAGE_NOTES` in
 * `lib/providers/places/coverage.ts`) and no human text. They are translated
 * here by key; a code without a translation is shown verbatim rather than
 * guessed at, so a new planner note can never be described wrongly.
 */
export function CoverageNotes({ notes, className }: CoverageNotesProps) {
  const t = useT("scans");
  if (notes.length === 0) return null;

  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {notes.map((note, index) => {
        const parsed = parseNote(note);
        const key = `coverage.notes.${parsed.code}`;
        const label = t(key, parsed.params);
        const translated = label !== key;

        return (
          <li key={`${parsed.code}-${index}`} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {translated ? <span>{label}</span> : <span className="font-mono">{note}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function parseNote(note: string): ParsedNote {
  const [code = note, rest] = note.split(":");
  if (!rest) return { code, params: {} };
  const params: Record<string, string> = {};
  for (const pair of rest.split(",")) {
    const [key, value] = pair.split("=");
    if (key && value !== undefined) params[key] = value;
  }
  return { code, params };
}
