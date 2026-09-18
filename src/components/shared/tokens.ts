import type { ConfidenceLevel, EvidenceType, ObservationStatus } from "@/types/common";
import type { FindingSeverity } from "@/types/audits";
import type { WebsiteStatus } from "@/types/signals";

/**
 * Semantic colour tones shared by every status-bearing component.
 * Convention (docs/conventions.md): emerald = good/found, amber = warning/
 * ambiguous, rose = bad/error, slate = not checked/unknown, sky = info.
 */
export type Tone = "positive" | "attention" | "negative" | "neutral" | "info";

/** Badge-style surface: tinted background + readable text in both themes. */
export const toneBadgeClass: Record<Tone, string> = {
  positive: "border-emerald-600/25 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300",
  attention: "border-amber-600/25 bg-amber-500/14 text-amber-700 dark:border-amber-400/25 dark:text-amber-300",
  negative: "border-rose-600/25 bg-rose-500/12 text-rose-700 dark:border-rose-400/25 dark:text-rose-300",
  neutral: "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:border-slate-400/20 dark:text-slate-300",
  info: "border-sky-600/25 bg-sky-500/12 text-sky-700 dark:border-sky-400/25 dark:text-sky-300",
};

/** Foreground-only variant for icons, rings and inline marks. */
export const toneTextClass: Record<Tone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  attention: "text-amber-600 dark:text-amber-400",
  negative: "text-rose-600 dark:text-rose-400",
  neutral: "text-slate-500 dark:text-slate-400",
  info: "text-sky-600 dark:text-sky-400",
};

/** Solid fill used by bars and rings. */
export const toneFillClass: Record<Tone, string> = {
  positive: "bg-emerald-500",
  attention: "bg-amber-500",
  negative: "bg-rose-500",
  neutral: "bg-slate-400 dark:bg-slate-500",
  info: "bg-sky-500",
};

/** SVG stroke used by ScoreRing. */
export const toneStrokeClass: Record<Tone, string> = {
  positive: "stroke-emerald-500",
  attention: "stroke-amber-500",
  negative: "stroke-rose-500",
  neutral: "stroke-slate-400 dark:stroke-slate-500",
  info: "stroke-sky-500",
};

export const observationTone: Record<ObservationStatus, Tone> = {
  found: "positive",
  not_found: "negative",
  not_checked: "neutral",
  unavailable: "attention",
  error: "negative",
  ambiguous: "attention",
};

export const websiteStatusTone: Record<WebsiteStatus, Tone> = {
  found: "positive",
  not_found: "negative",
  unreachable: "attention",
  redirected: "info",
  invalid: "attention",
  not_checked: "neutral",
};

export const evidenceTone: Record<EvidenceType, Tone> = {
  observed: "positive",
  derived: "info",
  heuristic: "attention",
  unavailable: "neutral",
};

export const confidenceTone: Record<ConfidenceLevel, Tone> = {
  high: "positive",
  medium: "attention",
  low: "neutral",
};

export const severityTone: Record<FindingSeverity, Tone> = {
  info: "info",
  low: "neutral",
  medium: "attention",
  high: "negative",
};

export type ScoreTier = "high" | "medium" | "low";

/**
 * Score tiers per docs/conventions.md: >= 70 emerald, 40-69 amber, < 40 slate.
 * A null score is not a zero score; callers must render "not scored" instead.
 */
export function scoreTier(score: number): ScoreTier {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export const scoreTierTone: Record<ScoreTier, Tone> = {
  high: "positive",
  medium: "attention",
  low: "neutral",
};

/** Clamp any numeric score into the 0-100 display range. */
export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}
