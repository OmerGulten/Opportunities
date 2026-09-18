import { createFindingCollector } from "@/lib/audits/finding";
import { createSignalFactory } from "@/lib/audits/signal";
import type { Finding, WebsiteAuditSummary } from "@/types/audits";
import type { Locale } from "@/types/common";
import { SIGNAL_TYPES, type Signal } from "@/types/signals";

/**
 * Branding signals derived from the website audit. There is no separate branding
 * fetch: if the website was not audited, every branding signal is explicitly
 * unavailable rather than false.
 */

export const LOW_CONSISTENCY_SCORE = 50;

export function brandingSignals(summary: WebsiteAuditSummary, locale: Locale): { signals: Signal[]; findings: Finding[] } {
  const signals = createSignalFactory(locale, "website_audit");
  const collector = createFindingCollector(locale, "website");
  const branding = summary.branding;

  if (branding === null) {
    const reason = summary.websiteStatus === "not_found" ? "website_not_found" : "website_not_audited";
    return {
      signals: [
        signals.unavailable(SIGNAL_TYPES.BRANDING_HAS_LOGO_SIGNAL, reason),
        signals.unavailable(SIGNAL_TYPES.BRANDING_NAME_CONSISTENCY, reason),
        signals.unavailable(SIGNAL_TYPES.BRANDING_CONSISTENCY_SCORE, reason),
      ],
      findings: [],
    };
  }

  const out: Signal[] = [
    signals.emit(SIGNAL_TYPES.BRANDING_HAS_LOGO_SIGNAL, branding.hasLogoSignal, { confidence: "medium" }),
    signals.emit(SIGNAL_TYPES.BRANDING_NAME_CONSISTENCY, branding.nameConsistency ?? false, { confidence: "medium" }),
    signals.emit(SIGNAL_TYPES.BRANDING_CONSISTENCY_SCORE, branding.consistencyScore, { evidenceType: "heuristic", confidence: "low" }),
  ];

  if (!branding.hasLogoSignal) {
    collector.add({ key: "branding_missing_logo", category: "branding", severity: "medium", status: "not_found", confidence: "medium", evidence: {} });
  }
  if (branding.nameConsistency === false) {
    collector.add({
      key: "branding_name_inconsistent",
      category: "branding",
      severity: "medium",
      confidence: "medium",
      evidence: { title: summary.seo?.title ?? null },
    });
  }
  if (branding.consistencyScore < LOW_CONSISTENCY_SCORE) {
    collector.add({
      key: "branding_low_consistency",
      category: "branding",
      severity: "low",
      evidenceType: "heuristic",
      confidence: "low",
      evidence: { consistencyScore: branding.consistencyScore },
      params: { score: branding.consistencyScore },
    });
  }

  return { signals: out, findings: collector.findings };
}
