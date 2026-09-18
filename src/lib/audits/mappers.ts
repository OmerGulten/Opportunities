import { signalToRow } from "@/lib/scoring/mappers";
import type { AuditOutcome, Finding } from "@/types/audits";
import type { AuditDepth, Json } from "@/types/common";
import type { AuditFindingRow, BusinessAuditRow, OpportunitySignalRow } from "@/types/db";

import type { BusinessAuditBundle } from "./run-business-audit";

/**
 * Pure mapping from an audit bundle to database rows. No Supabase client, no
 * IO: the workflow step inserts the audits, then calls `findingsFor` with the
 * returned ids. `audits[i]` corresponds to `bundle.outcomes[i]`, which is the
 * contract `findingsFor` relies on.
 */

export type BusinessAuditInsert = Omit<BusinessAuditRow, "id" | "created_at">;
export type AuditFindingInsert = Omit<AuditFindingRow, "id" | "created_at">;
export type OpportunitySignalInsert = Omit<OpportunitySignalRow, "id" | "created_at">;

export interface AuditRowIds {
  businessId: string;
  workspaceId: string;
  scanId?: string | null;
  depth: AuditDepth;
}

export interface AuditRows {
  audits: BusinessAuditInsert[];
  /** Findings of `bundle.outcomes[outcomeIndex]`, bound to the inserted audit row. */
  findingsFor(outcomeIndex: number, auditId: string): AuditFindingInsert[];
  signalRows(extra?: { auditId?: string | null }): OpportunitySignalInsert[];
}

function toJsonRecord(value: unknown): Record<string, Json> {
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return {};
    const parsed: unknown = JSON.parse(serialized);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, Json>) : {};
  } catch {
    return {};
  }
}

function auditRow(outcome: AuditOutcome<unknown>, ids: AuditRowIds, now: Date): BusinessAuditInsert {
  const completedAt = now.toISOString();
  const startedAt = new Date(now.getTime() - Math.max(0, outcome.durationMs)).toISOString();
  return {
    business_id: ids.businessId,
    workspace_id: ids.workspaceId,
    scan_id: ids.scanId ?? null,
    audit_type: outcome.auditType,
    depth: ids.depth,
    status: outcome.status,
    observation: outcome.observation ?? null,
    summary: toJsonRecord(outcome.summary),
    source: outcome.source,
    started_at: startedAt,
    completed_at: outcome.status === "completed" || outcome.status === "failed" ? completedAt : null,
    duration_ms: Math.max(0, Math.round(outcome.durationMs)),
    error_code: outcome.errorCode ?? null,
    error_message: outcome.errorMessage ?? null,
  };
}

function findingRow(finding: Finding, auditId: string, ids: AuditRowIds): AuditFindingInsert {
  return {
    audit_id: auditId,
    business_id: ids.businessId,
    workspace_id: ids.workspaceId,
    key: finding.key,
    category: finding.category,
    severity: finding.severity,
    status: finding.status,
    evidence_type: finding.evidenceType,
    confidence: finding.confidence,
    title: finding.title,
    explanation: finding.explanation ?? null,
    why_it_matters: finding.whyItMatters ?? null,
    evidence: toJsonRecord(finding.evidence),
    source: finding.source,
    detected_at: finding.detectedAt,
  };
}

export function toAuditRows(bundle: BusinessAuditBundle, ids: AuditRowIds): AuditRows {
  const now = new Date();
  const audits = bundle.outcomes.map((outcome) => auditRow(outcome, ids, now));

  return {
    audits,
    findingsFor(outcomeIndex: number, auditId: string): AuditFindingInsert[] {
      const outcome = bundle.outcomes[outcomeIndex];
      if (outcome === undefined) return [];
      return outcome.findings.map((finding) => findingRow(finding, auditId, ids));
    },
    signalRows(extra: { auditId?: string | null } = {}): OpportunitySignalInsert[] {
      return bundle.signals.map((signal) =>
        signalToRow(signal, {
          businessId: ids.businessId,
          workspaceId: ids.workspaceId,
          scanId: ids.scanId ?? null,
          auditId: extra.auditId ?? null,
        }),
      );
    },
  };
}
