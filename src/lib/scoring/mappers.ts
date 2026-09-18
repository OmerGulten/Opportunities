import type { Json } from "@/types/common";
import type { OpportunityRow, OpportunityScoreRow, OpportunitySignalRow, ServiceRow, ServiceRuleRow } from "@/types/db";
import type { OpportunityResult, RuleOperator, ServiceDefinition, ServiceRule } from "@/types/scoring";
import type { Signal, SignalSource, SignalValue } from "@/types/signals";

import { toJsonArray, toJsonValue } from "./json";

/** Insert shape for public.opportunity_signals (unique on business_id + signal_type; upsert on it). */
export type OpportunitySignalInsert = Omit<OpportunitySignalRow, "id" | "created_at">;
/** Insert shape for public.opportunity_scores (unique on opportunity_id + service_id). */
export type OpportunityScoreInsert = Omit<OpportunityScoreRow, "id" | "created_at">;
/** Insert shape for public.opportunities (unique on business_id). */
export type OpportunityInsert = Omit<OpportunityRow, "id" | "created_at" | "updated_at">;

export interface SignalRowIds {
  businessId: string;
  workspaceId: string;
  scanId?: string | null;
  auditId?: string | null;
}

export interface OpportunityScoreRowIds {
  opportunityId: string;
  businessId: string;
  workspaceId: string;
}

export interface OpportunityRowIds {
  businessId: string;
  workspaceId: string;
  scanId?: string | null;
}

export function ruleFromRow(row: ServiceRuleRow): ServiceRule {
  return {
    id: row.id,
    serviceId: row.service_id,
    key: row.key,
    nameTr: row.name_tr,
    nameEn: row.name_en,
    explanationTr: row.explanation_tr,
    explanationEn: row.explanation_en,
    signalType: row.signal_type,
    // An unknown operator (possible after a manual DB edit) is kept verbatim;
    // evaluateOperator returns false for it, so the rule simply never matches.
    operator: row.operator as RuleOperator,
    value: row.value,
    points: row.points,
    minConfidence: row.min_confidence,
    requiresDepth: row.requires_depth,
    active: row.active,
    sortOrder: row.sort_order,
    version: row.version,
  };
}

export function serviceFromRow(row: ServiceRow): ServiceDefinition {
  return {
    id: row.id,
    key: row.key,
    nameTr: row.name_tr,
    nameEn: row.name_en,
    scoreNormalizer: row.score_normalizer,
    sortOrder: row.sort_order,
    active: row.active,
  };
}

function jsonToSignalValue(value: Json | null): SignalValue {
  if (value === null) return null;
  // Objects (and JSON arrays, which are objects too) are carried opaquely; operators compare them structurally.
  if (typeof value === "object") return value as unknown as Record<string, unknown>;
  return value;
}

export function signalFromRow(row: OpportunitySignalRow): Signal {
  return {
    signalType: row.signal_type,
    // The column is free text; the domain union documents the values audits are expected to write.
    source: row.source as SignalSource,
    status: row.status,
    evidenceType: row.evidence_type,
    confidence: row.confidence,
    value: jsonToSignalValue(row.value),
    explanation: row.explanation ?? "",
    detectedAt: row.detected_at,
  };
}

export function signalToRow(signal: Signal, ids: SignalRowIds): OpportunitySignalInsert {
  return {
    business_id: ids.businessId,
    workspace_id: ids.workspaceId,
    scan_id: ids.scanId ?? null,
    audit_id: ids.auditId ?? null,
    signal_type: signal.signalType,
    source: signal.source,
    status: signal.status,
    evidence_type: signal.evidenceType,
    confidence: signal.confidence,
    value: toJsonValue(signal.value),
    explanation: signal.explanation.trim() === "" ? null : signal.explanation,
    detected_at: signal.detectedAt,
  };
}

export function toOpportunityScoreRows(result: OpportunityResult, ids: OpportunityScoreRowIds): OpportunityScoreInsert[] {
  return result.serviceScores.map((serviceScore) => ({
    opportunity_id: ids.opportunityId,
    business_id: ids.businessId,
    workspace_id: ids.workspaceId,
    service_id: serviceScore.serviceId,
    score: serviceScore.score,
    raw_points: Math.round(serviceScore.rawPoints),
    max_points: Math.round(serviceScore.maxPoints),
    confidence: serviceScore.confidence,
    reasons: toJsonArray(serviceScore.reasons),
    unavailable_rules: toJsonArray(serviceScore.unavailableRules),
  }));
}

export function toOpportunityRow(result: OpportunityResult, ids: OpportunityRowIds): OpportunityInsert {
  return {
    business_id: ids.businessId,
    workspace_id: ids.workspaceId,
    scan_id: ids.scanId ?? null,
    overall_score: result.overallScore,
    primary_service_id: result.primaryServiceId,
    secondary_service_ids: [...result.secondaryServiceIds],
    confidence: result.confidence,
    status: "calculated",
    digital_gaps: [...result.digitalGaps],
    rules_version: result.rulesVersion,
    calculated_at: result.calculatedAt,
  };
}
