import { InlineAlert, StatusBadge } from "@/components/shared";
import { getT } from "@/lib/i18n";
import type { Locale, ObservationStatus } from "@/types/common";

import type { AuditWithFindings } from "./summaries";

/**
 * Says plainly when an audit did not complete.
 *
 * The stored `error_code` is an application error code, so it is localized
 * through the `errors` namespace; raw provider or database messages are never
 * shown. A failed audit is never presented as a clean result.
 */
export function AuditStatusNotice({ audit, locale }: { audit: AuditWithFindings | null; locale: Locale }) {
  if (!audit || audit.status === "completed") return null;

  const te = getT(locale, "errors");
  const code = audit.error_code ?? "internal_error";
  const message = te(code);

  return <InlineAlert tone="attention">{message === code ? te("generic") : message}</InlineAlert>;
}

/** The audit's own observation status, when it recorded one. */
export function AuditObservation({ audit }: { audit: AuditWithFindings | null }) {
  if (!audit?.observation) return null;
  return <StatusBadge status={audit.observation as ObservationStatus} />;
}
