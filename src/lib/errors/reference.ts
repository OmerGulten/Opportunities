import { getT } from "@/lib/i18n";
import type { Locale } from "@/types/common";

import { AppError } from "./index";

/**
 * Turning an opaque failure into something a user can report back.
 *
 * Server actions answer an unrecognised failure with one generic sentence and
 * write the real cause to a log nobody reads, so "could not save" covers a
 * mistyped URL and a broken RLS policy alike. A Postgres 42P17 took an hour to
 * find for exactly this reason. Attaching the driver's own code gives the
 * person on screen something to quote and gives us something to search.
 *
 * Only the code travels, never the driver's message: that text can quote the
 * row it choked on, which is the caller's data and not ours to put on screen.
 */

/**
 * Looks like a driver error code (`42P17`, `PGRST200`, `ECONNREFUSED`) rather
 * than prose. A SQLSTATE opens with digits, so the first character is not
 * required to be a letter; the absence of whitespace is what keeps a message
 * from passing as a code.
 */
const CODE_SHAPE = /^[A-Z0-9][A-Z0-9_]{1,19}$/i;

function readCode(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const code = (value as { code?: unknown }).code;
  if (typeof code === "string" && CODE_SHAPE.test(code)) return code;
  // Postgres surfaces SQLSTATE as a number through some drivers.
  if (typeof code === "number" && Number.isInteger(code)) return String(code);
  return null;
}

/**
 * A short, non-sensitive token identifying the cause, or null when there is
 * nothing more specific to say than "it failed".
 *
 * AppError is deliberately not unwrapped here: its code already travels as the
 * result's own `code` and its message is already written for a reader, so
 * appending a reference to it would only add noise.
 */
export function diagnosticCode(cause: unknown): string | null {
  if (cause instanceof AppError) return null;
  return readCode(cause) ?? readCode((cause as { cause?: unknown } | null)?.cause);
}

/**
 * `message` with a reference appended, when there is one to add. Takes the
 * locale rather than reading the request so this stays usable from anywhere.
 *
 * The reference is not always a driver code: a validation issue we have no
 * sentence for passes the field path instead, so "could not save" at least
 * says which input was rejected.
 */
export function withReferenceCode(message: string, code: string | null, locale: Locale): string {
  if (!code) return message;
  return getT(locale, "errors")("withReference", { message, code });
}

/** `withReferenceCode` over whatever code can be read off `cause`. */
export function appendReference(message: string, cause: unknown, locale: Locale): string {
  return withReferenceCode(message, diagnosticCode(cause), locale);
}
