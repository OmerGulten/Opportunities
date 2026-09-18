import type { ConfidenceLevel, Locale } from "@/types/common";
import type { OpportunityResult, ServiceScoreResult, UnavailableRule } from "@/types/scoring";

/**
 * Human-readable explanations of scores. Rule names and explanations are already
 * localized by the engine; the handful of fixed words used here live in a local
 * phrase table because the `opportunities` i18n namespace is owned by the
 * opportunities feature. Wording is deliberately neutral.
 */

interface PhraseTable {
  headline: string;
  heuristicSuffix: string;
  unavailableLine: string;
  points: string;
  confidence: Record<ConfidenceLevel, string>;
  reason: Record<UnavailableRule["reason"], string>;
  summaryNoPrimary: string;
  summaryPrimary: string;
  summarySecondaries: string;
  summaryGaps: string;
  summaryNoSecondaries: string;
}

const PHRASES: Record<Locale, PhraseTable> = {
  tr: {
    headline: "Skor {{score}}/100 · {{raw}}/{{max}} puan · {{matched}} eşleşen kural · güven: {{confidence}}",
    heuristicSuffix: " (sezgisel)",
    unavailableLine: "{{name}} — değerlendirilemedi: {{reason}} ({{points}} {{pointsWord}})",
    points: "puan",
    confidence: { high: "yüksek", medium: "orta", low: "düşük" },
    reason: {
      signal_missing: "sinyal üretilmedi",
      not_checked: "kontrol edilmedi",
      unavailable: "veri alınamadı",
      error: "denetim hatası",
      low_confidence: "güven düzeyi yetersiz",
      depth_not_reached: "denetim derinliği yetersiz",
    },
    summaryNoPrimary: "Değerlendirilebilir sinyal bulunmadığı için fırsat skoru hesaplanamadı.",
    summaryPrimary: "Öne çıkan fırsat: {{service}} ({{score}}/100, güven: {{confidence}}).",
    summarySecondaries: "İkincil fırsatlar: {{services}}.",
    summaryGaps: "Gözlemlenen dijital eksik sayısı: {{count}}.",
    summaryNoSecondaries: "Eşiğin üzerinde başka hizmet fırsatı gözlemlenmedi.",
  },
  en: {
    headline: "Score {{score}}/100 · {{raw}}/{{max}} points · {{matched}} matched rules · confidence: {{confidence}}",
    heuristicSuffix: " (heuristic)",
    unavailableLine: "{{name}} — not evaluated: {{reason}} ({{points}} {{pointsWord}})",
    points: "points",
    confidence: { high: "high", medium: "medium", low: "low" },
    reason: {
      signal_missing: "signal not produced",
      not_checked: "not checked",
      unavailable: "data unavailable",
      error: "audit error",
      low_confidence: "confidence too low",
      depth_not_reached: "audit depth not reached",
    },
    summaryNoPrimary: "No opportunity score could be calculated because no evaluable signals were available.",
    summaryPrimary: "Primary opportunity: {{service}} ({{score}}/100, confidence: {{confidence}}).",
    summarySecondaries: "Secondary opportunities: {{services}}.",
    summaryGaps: "Observed digital gaps: {{count}}.",
    summaryNoSecondaries: "No other service opportunity was observed above the threshold.",
  },
};

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) => {
    const value = params[name];
    return value === undefined ? "" : String(value);
  });
}

function phrases(locale: Locale): PhraseTable {
  return PHRASES[locale] ?? PHRASES.tr;
}

export interface ServiceScoreExplanation {
  headline: string;
  /** One line per matched rule, e.g. "+55 Web sitesi bulunamadı". Heuristic evidence is marked. */
  lines: string[];
  /** One line per rule that could not be evaluated, with the reason. */
  unavailableLines: string[];
}

/**
 * Explains one service score. `ruleNames` (ruleKey -> localized name) is optional
 * and only improves the unavailable lines, which otherwise show the rule key.
 */
export function explainServiceScore(result: ServiceScoreResult, locale: Locale, ruleNames: Record<string, string> = {}): ServiceScoreExplanation {
  const p = phrases(locale);
  const headline = fill(p.headline, {
    score: result.score,
    raw: result.rawPoints,
    max: result.maxPoints,
    matched: result.reasons.length,
    confidence: p.confidence[result.confidence] ?? result.confidence,
  });

  const lines = result.reasons.map((reason) => {
    const sign = reason.points >= 0 ? "+" : "";
    const suffix = reason.evidenceType === "heuristic" ? p.heuristicSuffix : "";
    return `${sign}${reason.points} ${reason.name}${suffix}`;
  });

  const unavailableLines = result.unavailableRules.map((rule) =>
    fill(p.unavailableLine, {
      name: ruleNames[rule.ruleKey] ?? rule.ruleKey,
      reason: p.reason[rule.reason] ?? rule.reason,
      points: rule.points,
      pointsWord: p.points,
    }),
  );

  return { headline, lines, unavailableLines };
}

function serviceLabel(serviceNames: Record<string, string>, id: string | null, key: string | null): string {
  if (id && serviceNames[id]) return serviceNames[id];
  if (key && serviceNames[key]) return serviceNames[key];
  return key ?? id ?? "";
}

/**
 * One or two neutral sentences summarising an opportunity result.
 * `serviceNames` maps service id (or key) to a localized display name.
 */
export function summarizeOpportunity(result: OpportunityResult, serviceNames: Record<string, string>, locale: Locale): string {
  const p = phrases(locale);
  const primary = result.serviceScores.find((score) => score.serviceId === result.primaryServiceId);
  if (!result.primaryServiceId || !primary || primary.evaluablePoints <= 0) return p.summaryNoPrimary;

  const first = fill(p.summaryPrimary, {
    service: serviceLabel(serviceNames, result.primaryServiceId, result.primaryServiceKey),
    score: primary.score,
    confidence: p.confidence[result.confidence] ?? result.confidence,
  });

  let second: string;
  if (result.secondaryServiceIds.length > 0) {
    const names = result.secondaryServiceIds.map((id, index) => serviceLabel(serviceNames, id, result.secondaryServiceKeys[index] ?? null));
    second = fill(p.summarySecondaries, { services: names.join(", ") });
  } else if (result.digitalGaps.length > 0) {
    second = fill(p.summaryGaps, { count: result.digitalGaps.length });
  } else {
    second = p.summaryNoSecondaries;
  }

  return `${first} ${second}`;
}
