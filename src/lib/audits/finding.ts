import { getT, type TFunction, type TranslateParams } from "@/lib/i18n";
import type { Finding, FindingCategory, FindingSeverity } from "@/types/audits";
import type { ConfidenceLevel, EvidenceType, Locale, ObservationStatus } from "@/types/common";

/**
 * Findings are the human half of an audit (signals are the machine half). Every
 * string comes from the `findings` i18n namespace, keyed by the finding key:
 * `<key>.title`, `<key>.explanation`, `<key>.why`. Keys use underscores because
 * the translator splits lookups on dots.
 */
export interface FindingInput {
  key: string;
  category: FindingCategory;
  severity: FindingSeverity;
  source: string;
  /** Defaults to `found`: the finding itself is an observation that was made. */
  status?: ObservationStatus;
  evidenceType?: EvidenceType;
  confidence?: ConfidenceLevel;
  evidence?: Record<string, unknown>;
  /** Interpolated into title / explanation / why. */
  params?: TranslateParams;
  detectedAt?: string;
}

export function findingsT(locale: Locale): TFunction {
  return getT(locale, "findings");
}

export function makeFinding(t: TFunction, input: FindingInput): Finding {
  return {
    key: input.key,
    category: input.category,
    severity: input.severity,
    status: input.status ?? "found",
    evidenceType: input.evidenceType ?? "observed",
    confidence: input.confidence ?? "medium",
    title: t(`${input.key}.title`, input.params),
    explanation: t(`${input.key}.explanation`, input.params),
    whyItMatters: t(`${input.key}.why`, input.params),
    evidence: input.evidence ?? {},
    source: input.source,
    detectedAt: input.detectedAt ?? new Date().toISOString(),
  };
}

/** Collects findings for one audit without repeating the translator argument. */
export function createFindingCollector(locale: Locale, source: string) {
  const t = findingsT(locale);
  const findings: Finding[] = [];
  return {
    t,
    findings,
    add(input: Omit<FindingInput, "source"> & { source?: string }): Finding {
      const finding = makeFinding(t, { ...input, source: input.source ?? source });
      findings.push(finding);
      return finding;
    },
  };
}
