import { ConfidenceBadge, EvidenceTypeBadge, SeverityBadge, StatusBadge } from "@/components/shared";
import { getT } from "@/lib/i18n";
import type { FindingSeverity } from "@/types/audits";
import type { Json, Locale, ObservationStatus } from "@/types/common";
import type { AuditFindingRow } from "@/types/db";

import { formatDateTime } from "./summaries";

/**
 * Human-facing findings.
 *
 * Each one carries its own status, evidence type and confidence, so a
 * heuristic result can never be read as a measurement and a rule that was not
 * checked can never be read as a missing feature. Titles and explanations were
 * localized when the audit ran.
 */

const MAX_EVIDENCE_ENTRIES = 6;

function evidenceEntries(evidence: Record<string, Json>): Array<{ key: string; value: string }> {
  return Object.entries(evidence ?? {})
    .map(([key, value]) => {
      if (value === null || value === undefined) return null;
      if (Array.isArray(value)) {
        const items = value.filter((entry) => typeof entry === "string" || typeof entry === "number").slice(0, 4);
        return items.length > 0 ? { key, value: items.join(", ") } : null;
      }
      if (typeof value === "object") return null;
      return { key, value: String(value) };
    })
    .filter((entry): entry is { key: string; value: string } => entry !== null)
    .slice(0, MAX_EVIDENCE_ENTRIES);
}

export interface FindingListProps {
  findings: AuditFindingRow[];
  locale: Locale;
  /** Sentence shown when the group produced no findings at all. */
  emptyLabel?: string;
}

export function FindingList({ findings, locale, emptyLabel }: FindingListProps) {
  const t = getT(locale, "businesses");

  if (findings.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel ?? t("detail.findings.empty")}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {findings.map((finding) => {
        const evidence = evidenceEntries(finding.evidence);
        const detectedAt = formatDateTime(finding.detected_at, locale);
        return (
          <li key={finding.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{finding.title}</span>
              <SeverityBadge severity={finding.severity as FindingSeverity} />
              <StatusBadge status={finding.status as ObservationStatus} />
              <EvidenceTypeBadge evidenceType={finding.evidence_type} />
              <ConfidenceBadge confidence={finding.confidence} withLabel />
            </div>

            {finding.explanation ? <p className="text-sm text-muted-foreground">{finding.explanation}</p> : null}

            {finding.why_it_matters ? (
              <p className="text-sm">
                <span className="text-muted-foreground">{t("detail.findings.whyItMatters")}: </span>
                {finding.why_it_matters}
              </p>
            ) : null}

            {evidence.length > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">{t("detail.findings.evidence")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {evidence.map((entry) => (
                    <span key={entry.key} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
                      {entry.key}: {entry.value}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              {t("detail.findings.source")}: {finding.source}
              {detectedAt ? ` · ${t("detail.findings.detectedAt")}: ${detectedAt}` : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
