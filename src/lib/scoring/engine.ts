import { AUDIT_DEPTH_ORDER, CONFIDENCE_ORDER, type ConfidenceLevel, type Locale } from "@/types/common";
import type {
  OpportunityResult,
  ScoreReason,
  ScoringOptions,
  ServiceDefinition,
  ServiceRule,
  ServiceScoreResult,
  UnavailableRule,
} from "@/types/scoring";
import type { Signal } from "@/types/signals";

import { deriveDigitalGaps } from "./gaps";
import { toJsonValue } from "./json";
import { evaluateOperator } from "./operators";
import { indexSignalsByType } from "./signal-index";

/** Default minimum service score to count as a secondary opportunity (mirrors system_settings.scan). */
export const DEFAULT_SECONDARY_THRESHOLD = 50;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safePoints(points: unknown): number {
  return typeof points === "number" && Number.isFinite(points) ? points : 0;
}

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function localizedName(rule: ServiceRule, locale: Locale): string {
  const primary = locale === "en" ? rule.nameEn : rule.nameTr;
  const fallback = locale === "en" ? rule.nameTr : rule.nameEn;
  return nonEmpty(primary) ?? nonEmpty(fallback) ?? rule.key;
}

function localizedExplanation(rule: ServiceRule, locale: Locale, name: string): string {
  const primary = locale === "en" ? rule.explanationEn : rule.explanationTr;
  const fallback = locale === "en" ? rule.explanationTr : rule.explanationEn;
  return nonEmpty(primary) ?? nonEmpty(fallback) ?? name;
}

/** sortOrder ascending, then key for a stable order when sortOrder ties. */
function compareByOrder<T extends { sortOrder: number; key: string }>(a: T, b: T): number {
  const orderDiff = safePoints(a.sortOrder) - safePoints(b.sortOrder);
  return orderDiff !== 0 ? orderDiff : a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/**
 * Normaliser used as the 100% mark. The service's `scoreNormalizer` wins when it
 * is a positive finite number; otherwise the sum of all active rule points
 * (regardless of depth) is used so a fully matching business scores 100.
 */
function resolveMaxPoints(service: ServiceDefinition, activeRules: readonly ServiceRule[]): number {
  const normalizer = service.scoreNormalizer;
  if (typeof normalizer === "number" && Number.isFinite(normalizer) && normalizer > 0) return normalizer;
  return activeRules.reduce((sum, rule) => sum + safePoints(rule.points), 0);
}

/**
 * Presence operators are decided on observation status, not on the raw value:
 * `exists` needs a `found` signal with a value; `not_exists` needs a `not_found`
 * observation (or a `found` observation that explicitly carries no value).
 * `ambiguous` matches neither.
 */
function evaluateRule(rule: ServiceRule, signal: Signal): boolean {
  if (rule.operator === "exists") return signal.status === "found" && signal.value !== null;
  if (rule.operator === "not_exists") return signal.status === "not_found" || (signal.status === "found" && signal.value === null);
  return evaluateOperator(rule.operator, signal.value, rule.value);
}

/**
 * Confidence of a service score reflects how much of the rule set could be
 * evaluated and how much of the matched evidence is observed/derived rather
 * than heuristic. It is not a probability of anything.
 */
export function serviceConfidence(evaluablePoints: number, maxPoints: number, rawPoints: number, observedPoints: number): ConfidenceLevel {
  if (evaluablePoints <= 0 || maxPoints <= 0) return "low";
  const ratio = evaluablePoints / maxPoints;
  const observedShare = observedPoints / Math.max(rawPoints, 1);
  if (ratio >= 0.7 && observedShare >= 0.5) return "high";
  if (ratio >= 0.4) return "medium";
  return "low";
}

/** Scores a single service. Exported for targeted tests; `scoreBusiness` is the public entry point. */
export function scoreService(
  service: ServiceDefinition,
  activeRules: readonly ServiceRule[],
  signalIndex: ReadonlyMap<string, Signal>,
  options: Pick<ScoringOptions, "locale" | "auditDepth">,
): ServiceScoreResult {
  const depthLimit = AUDIT_DEPTH_ORDER[options.auditDepth] ?? AUDIT_DEPTH_ORDER.discovery;
  const rules = [...activeRules].sort(compareByOrder);
  const maxPoints = resolveMaxPoints(service, rules);

  const reasons: ScoreReason[] = [];
  const unavailableRules: UnavailableRule[] = [];
  let rawPoints = 0;
  let evaluablePoints = 0;
  let observedPoints = 0;

  for (const rule of rules) {
    const points = safePoints(rule.points);
    const unavailable = (reason: UnavailableRule["reason"]): void => {
      unavailableRules.push({ ruleKey: rule.key, ruleId: rule.id, signalType: rule.signalType, reason, points });
    };

    // Depth gating: a rule that needs a deeper audit than the scan ran is not "false", it is unknown.
    const requiredDepth = AUDIT_DEPTH_ORDER[rule.requiresDepth] ?? AUDIT_DEPTH_ORDER.discovery;
    if (requiredDepth > depthLimit) {
      unavailable("depth_not_reached");
      continue;
    }

    const signal = signalIndex.get(rule.signalType);
    if (!signal) {
      unavailable("signal_missing");
      continue;
    }
    if (signal.status === "not_checked" || signal.status === "unavailable" || signal.status === "error") {
      unavailable(signal.status);
      continue;
    }
    if ((CONFIDENCE_ORDER[signal.confidence] ?? 0) < (CONFIDENCE_ORDER[rule.minConfidence] ?? 0)) {
      unavailable("low_confidence");
      continue;
    }

    evaluablePoints += points;
    if (!evaluateRule(rule, signal)) continue;

    rawPoints += points;
    if (signal.evidenceType === "observed" || signal.evidenceType === "derived") observedPoints += points;
    const name = localizedName(rule, options.locale);
    reasons.push({
      ruleKey: rule.key,
      ruleId: rule.id,
      points,
      signalType: rule.signalType,
      signalValue: toJsonValue(signal.value),
      evidenceType: signal.evidenceType,
      confidence: signal.confidence,
      explanation: localizedExplanation(rule, options.locale, name),
      name,
    });
  }

  const score = maxPoints > 0 && evaluablePoints > 0 ? clamp(Math.round((100 * rawPoints) / maxPoints), 0, 100) : 0;

  return {
    serviceId: service.id,
    serviceKey: service.key,
    score,
    rawPoints,
    maxPoints,
    evaluablePoints,
    confidence: serviceConfidence(evaluablePoints, maxPoints, rawPoints, observedPoints),
    reasons,
    unavailableRules,
  };
}

/**
 * Scores one business against the services a workspace sells.
 *
 * Only active services listed in `options.serviceIds` are scored, each with its
 * active rules. The primary opportunity is the highest service score (ties broken
 * by service sortOrder); secondaries are the other services at or above
 * `options.secondaryThreshold` (default 50), best first.
 *
 * `overallScore = round(0.7 * primary + 0.3 * mean(top three service scores))`:
 * the primary service dominates so a single strong fit ranks well, while the
 * mean of the top three rewards businesses with several concurrent gaps without
 * letting many weak fits outrank one clear opportunity. Overall confidence is the
 * primary service's confidence.
 *
 * `serviceScores` is returned best first. `now` exists for deterministic tests.
 */
export function scoreBusiness(
  signals: readonly Signal[],
  rules: readonly ServiceRule[],
  services: readonly ServiceDefinition[],
  options: ScoringOptions,
  now: Date = new Date(),
): OpportunityResult {
  const wanted = new Set(options.serviceIds);
  const selected = services.filter((service) => service.active && wanted.has(service.id)).sort(compareByOrder);
  const orderIndex = new Map(selected.map((service, index) => [service.id, index]));

  const rulesByService = new Map<string, ServiceRule[]>();
  for (const rule of rules) {
    if (!rule.active || !orderIndex.has(rule.serviceId)) continue;
    const bucket = rulesByService.get(rule.serviceId);
    if (bucket) bucket.push(rule);
    else rulesByService.set(rule.serviceId, [rule]);
  }

  const signalIndex = indexSignalsByType(signals);
  const serviceScores = selected
    .map((service) => scoreService(service, rulesByService.get(service.id) ?? [], signalIndex, options))
    .sort((a, b) => b.score - a.score || (orderIndex.get(a.serviceId) ?? 0) - (orderIndex.get(b.serviceId) ?? 0));

  const primary = serviceScores[0];
  const threshold = typeof options.secondaryThreshold === "number" && Number.isFinite(options.secondaryThreshold) ? options.secondaryThreshold : DEFAULT_SECONDARY_THRESHOLD;
  const secondaries = serviceScores.slice(1).filter((result) => result.score >= threshold);

  const topThree = serviceScores.slice(0, 3);
  const topMean = topThree.length > 0 ? topThree.reduce((sum, result) => sum + result.score, 0) / topThree.length : 0;
  const overallScore = primary ? clamp(Math.round(0.7 * primary.score + 0.3 * topMean), 0, 100) : 0;

  const rulesVersion = rules.reduce((max, rule) => (Number.isFinite(rule.version) && rule.version > max ? rule.version : max), 1);

  return {
    overallScore,
    primaryServiceId: primary?.serviceId ?? null,
    primaryServiceKey: primary?.serviceKey ?? null,
    secondaryServiceIds: secondaries.map((result) => result.serviceId),
    secondaryServiceKeys: secondaries.map((result) => result.serviceKey),
    confidence: primary?.confidence ?? "low",
    digitalGaps: deriveDigitalGaps(signals),
    serviceScores,
    rulesVersion,
    calculatedAt: now.toISOString(),
  };
}
