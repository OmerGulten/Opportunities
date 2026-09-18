import { createFindingCollector } from "@/lib/audits/finding";
import { createSignalFactory } from "@/lib/audits/signal";
import type { Finding, PerformanceAuditSummary } from "@/types/audits";
import type { Locale } from "@/types/common";
import { SIGNAL_TYPES, type Signal } from "@/types/signals";

/**
 * Turns a performance summary into signals and findings.
 *
 * The evidence type follows the provider: a PageSpeed run is `observed`, the
 * markup heuristic is `heuristic`, and every finding produced from a heuristic
 * summary says so in its own text.
 */

export const POOR_SCORE_MAX = 50;
export const GOOD_SCORE_MIN = 90;

export function gradeForScore(score: number): NonNullable<PerformanceAuditSummary["mobileGrade"]> {
  if (score < POOR_SCORE_MAX) return "poor";
  return score >= GOOD_SCORE_MIN ? "good" : "needs_improvement";
}

export function performanceSignals(summary: PerformanceAuditSummary, locale: Locale): { signals: Signal[]; findings: Finding[] } {
  const signals = createSignalFactory(locale, "performance");
  const collector = createFindingCollector(locale, summary.source);
  const evidenceType = summary.isHeuristic ? "heuristic" : "observed";
  const confidence = summary.isHeuristic ? "low" : "high";
  const method = collector.t(summary.isHeuristic ? "method.heuristic" : "method.measured");

  const numeric: Array<[string, number | null]> = [
    [SIGNAL_TYPES.PERFORMANCE_MOBILE_SCORE, summary.mobileScore],
    [SIGNAL_TYPES.PERFORMANCE_DESKTOP_SCORE, summary.desktopScore],
    [SIGNAL_TYPES.PERFORMANCE_LCP_MS, summary.lcpMs],
    [SIGNAL_TYPES.PERFORMANCE_CLS, summary.cls],
    [SIGNAL_TYPES.PERFORMANCE_INP_MS, summary.inpMs],
  ];

  const out: Signal[] = [];
  for (const [signalType, value] of numeric) {
    out.push(
      value === null
        ? signals.unavailable(signalType, "performance_metric_unavailable", { status: "unavailable", params: { source: summary.source } })
        : signals.emit(signalType, value, { evidenceType, confidence, params: { method, source: summary.source } }),
    );
  }

  const grade = summary.mobileGrade ?? (summary.mobileScore === null ? null : gradeForScore(summary.mobileScore));
  out.push(
    grade === null
      ? signals.unavailable(SIGNAL_TYPES.PERFORMANCE_MOBILE_GRADE, "performance_metric_unavailable", { status: "unavailable", params: { source: summary.source } })
      : signals.emit(SIGNAL_TYPES.PERFORMANCE_MOBILE_GRADE, grade, { evidenceType, confidence, params: { method, source: summary.source } }),
  );

  if (summary.mobileScore !== null) {
    const params = { score: summary.mobileScore, method, source: summary.source };
    if (summary.mobileScore < POOR_SCORE_MAX) {
      collector.add({
        key: "performance_poor_mobile",
        category: "performance",
        severity: "high",
        evidenceType,
        confidence,
        evidence: { mobileScore: summary.mobileScore, isHeuristic: summary.isHeuristic, notes: summary.notes },
        params,
      });
    } else if (summary.mobileScore < GOOD_SCORE_MIN) {
      collector.add({
        key: "performance_needs_improvement",
        category: "performance",
        severity: "medium",
        evidenceType,
        confidence,
        evidence: { mobileScore: summary.mobileScore, isHeuristic: summary.isHeuristic, notes: summary.notes },
        params,
      });
    }
  }

  return { signals: out, findings: collector.findings };
}
