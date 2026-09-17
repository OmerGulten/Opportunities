import type { AuditDepth, ConfidenceLevel, EvidenceType, Json } from "./common";

export type RuleOperator =
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "not_in"
  | "exists"
  | "not_exists"
  | "between"
  | "is_true"
  | "is_false";

/** Mirrors public.service_rules */
export interface ServiceRule {
  id: string;
  serviceId: string;
  key: string;
  nameTr: string;
  nameEn: string;
  explanationTr: string | null;
  explanationEn: string | null;
  signalType: string;
  operator: RuleOperator;
  value: Json | null;
  points: number;
  minConfidence: ConfidenceLevel;
  requiresDepth: AuditDepth;
  active: boolean;
  sortOrder: number;
  version: number;
}

/** Mirrors public.services (subset needed by the engine) */
export interface ServiceDefinition {
  id: string;
  key: string;
  nameTr: string;
  nameEn: string;
  scoreNormalizer: number | null;
  sortOrder: number;
  active: boolean;
}

export interface ScoreReason {
  ruleKey: string;
  ruleId: string;
  points: number;
  signalType: string;
  signalValue: Json;
  evidenceType: EvidenceType;
  confidence: ConfidenceLevel;
  explanation: string; // localized at evaluation time using the workspace locale
  name: string;
}

export interface UnavailableRule {
  ruleKey: string;
  ruleId: string;
  signalType: string;
  reason: "signal_missing" | "not_checked" | "unavailable" | "error" | "low_confidence" | "depth_not_reached";
  points: number;
}

export interface ServiceScoreResult {
  serviceId: string;
  serviceKey: string;
  score: number; // 0-100
  rawPoints: number;
  maxPoints: number; // normalizer used
  evaluablePoints: number; // points of rules that could be evaluated
  confidence: ConfidenceLevel;
  reasons: ScoreReason[];
  unavailableRules: UnavailableRule[];
}

export type DigitalGap =
  | "no_website"
  | "weak_website"
  | "no_https"
  | "no_instagram"
  | "inactive_instagram"
  | "google_incomplete"
  | "low_reviews"
  | "low_rating"
  | "missing_hours"
  | "few_photos"
  | "slow_mobile"
  | "unanswered_reviews";

export interface OpportunityResult {
  overallScore: number;
  primaryServiceId: string | null;
  primaryServiceKey: string | null;
  secondaryServiceIds: string[];
  secondaryServiceKeys: string[];
  confidence: ConfidenceLevel;
  digitalGaps: DigitalGap[];
  serviceScores: ServiceScoreResult[];
  rulesVersion: number;
  calculatedAt: string;
}

export interface ScoringOptions {
  locale: "tr" | "en";
  auditDepth: AuditDepth;
  /** Services the workspace sells (ids). Only these are scored. */
  serviceIds: string[];
  /** Minimum score for a service to count as a secondary opportunity (default 50). */
  secondaryThreshold?: number;
}
