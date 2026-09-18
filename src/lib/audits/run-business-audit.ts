import { createLogger } from "@/lib/logging";
import { toAppError } from "@/lib/errors";
import type { PerformanceProvider } from "@/lib/providers/performance/types";
import type { SafeFetcher } from "@/lib/security/safe-fetch";
import type { AuditOutcome, AuditType, Finding, InstagramAuditSummary, PerformanceAuditSummary, WebsiteAuditSummary } from "@/types/audits";
import type { AuditDepth, Locale, ObservationStatus } from "@/types/common";
import type { PlaceDetails } from "@/types/places";
import { SIGNAL_TYPES, type Signal, type SignalSource, type WebsiteStatus } from "@/types/signals";

import { brandingSignals } from "./branding/derive";
import { createSignalFactory, mergeSignals, type UnavailableReason } from "./signal";
import { auditGoogleBusiness, providerFieldChecked } from "./google-business/audit";
import { discoverInstagram } from "./instagram/discover";
import { performanceSignals } from "./performance/signals";
import { auditWebsite } from "./website/audit";

/**
 * Runs every audit for one business and merges the results.
 *
 * Failure isolation is the point of this file: one sub-audit throwing must not
 * lose the others. Each is wrapped, and a failure still produces an outcome
 * (status `failed`) plus explicitly unavailable signals for its area, so the
 * scoring engine sees "not checked" instead of silently missing data.
 */

const logger = createLogger({ module: "audits/run-business-audit" });

const WEBSITE_SIGNAL_TYPES = Object.values(SIGNAL_TYPES).filter((type) => type.startsWith("website."));
const GOOGLE_SIGNAL_TYPES = Object.values(SIGNAL_TYPES).filter((type) => type.startsWith("google."));
const INSTAGRAM_SIGNAL_TYPES = Object.values(SIGNAL_TYPES).filter((type) => type.startsWith("instagram."));
const PERFORMANCE_SIGNAL_TYPES = Object.values(SIGNAL_TYPES).filter((type) => type.startsWith("performance."));

export interface BusinessAuditBundle {
  outcomes: Array<AuditOutcome<unknown>>;
  signals: Signal[];
  findings: Finding[];
  websiteStatus: WebsiteStatus;
  instagramStatus: ObservationStatus;
}

export interface RunBusinessAuditInput {
  details: PlaceDetails;
  depth: AuditDepth;
  locale: Locale;
  fetcher?: SafeFetcher;
  performanceProvider?: PerformanceProvider;
  features: { instagramDiscovery: boolean; performance: boolean };
}

export async function runBusinessAudit(input: RunBusinessAuditInput): Promise<BusinessAuditBundle> {
  const { details, depth, locale } = input;
  const outcomes: Array<AuditOutcome<unknown>> = [];

  // ---- Google Business ----------------------------------------------------
  const google = await isolate("google_business", locale, GOOGLE_SIGNAL_TYPES, "google_audit", "provider", async () =>
    auditGoogleBusiness(details, { locale }),
  );
  outcomes.push(google);

  // ---- Website ------------------------------------------------------------
  let websiteSummary: WebsiteAuditSummary | null = null;
  let websiteHtml: string | null = null;
  let websiteResponseTimeMs: number | null = null;
  let websiteAudited = false;

  if (depth === "discovery") {
    const outcome = discoveryWebsiteOutcome(details, locale);
    websiteSummary = outcome.summary;
    outcomes.push(outcome);
  } else {
    const started = Date.now();
    try {
      const result = await auditWebsite({
        url: details.websiteUri,
        businessName: details.displayName,
        locale,
        depth,
        fetcher: input.fetcher,
      });
      websiteHtml = result.html;
      websiteResponseTimeMs = result.responseTimeMs;
      websiteAudited = true;
      websiteSummary = result.outcome.summary;
      outcomes.push(result.outcome);
    } catch (error) {
      outcomes.push(failureOutcome("website", locale, WEBSITE_SIGNAL_TYPES, "website_audit", "website", error, started));
    }
  }

  const websiteStatus: WebsiteStatus = websiteSummary?.websiteStatus ?? "not_checked";

  // ---- Branding (derived from the website audit) --------------------------
  // Branding is not an audit type of its own, so its signals and findings ride
  // with the website outcome; that also keeps `findingsFor` in the mappers able
  // to attach every finding to a persisted audit row.
  const branding = brandingSignals(
    websiteSummary ?? {
      websiteStatus,
      inputUrl: details.websiteUri,
      technical: null,
      seo: null,
      ux: null,
      branding: null,
      qualityScore: null,
      quality: null,
      fetchedAt: new Date().toISOString(),
    },
    locale,
  );
  const websiteOutcomeIndex = outcomes.length - 1;
  const websiteOutcome = outcomes[websiteOutcomeIndex];
  outcomes[websiteOutcomeIndex] = {
    ...websiteOutcome,
    signals: [...websiteOutcome.signals, ...branding.signals],
    findings: [...websiteOutcome.findings, ...branding.findings],
  };

  // ---- Performance --------------------------------------------------------
  const performanceRunnable = depth === "deep" && input.features.performance && input.performanceProvider !== undefined && websiteStatus === "found";
  if (performanceRunnable && input.performanceProvider !== undefined) {
    const provider = input.performanceProvider;
    const targetUrl = websiteSummary?.technical?.finalUrl ?? details.websiteUri;
    const outcome = await isolate<PerformanceAuditSummary>("performance", locale, PERFORMANCE_SIGNAL_TYPES, "performance", provider.name, async () => {
      const summary = await provider.audit(targetUrl ?? "", {
        html: websiteHtml ?? undefined,
        responseTimeMs: websiteResponseTimeMs ?? undefined,
      });
      const derived = performanceSignals(summary, locale);
      const result: AuditOutcome<PerformanceAuditSummary> = {
        auditType: "performance",
        status: "completed",
        observation: summary.mobileScore === null ? "unavailable" : "found",
        source: summary.source,
        summary,
        findings: derived.findings,
        signals: derived.signals,
        durationMs: 0,
      };
      return result;
    });
    outcomes.push(outcome);
  } else {
    const reason: UnavailableReason = websiteStatus === "found" ? "performance_not_run" : "performance_no_website";
    outcomes.push(skippedOutcome("performance", locale, PERFORMANCE_SIGNAL_TYPES, "performance", "performance", reason));
  }

  // ---- Instagram ----------------------------------------------------------
  // A page we never parsed cannot testify about social links: only a parsed page
  // (or a profile with no website at all) produces a list instead of `null`.
  const websiteSocialLinks =
    websiteSummary?.ux !== null && websiteSummary?.ux !== undefined
      ? websiteSummary.ux.socialLinks
      : websiteAudited && websiteStatus === "not_found"
        ? []
        : null;

  let instagramStatus: ObservationStatus = "not_checked";
  if (depth !== "discovery" && input.features.instagramDiscovery) {
    const outcome = await isolate<InstagramAuditSummary>("instagram", locale, INSTAGRAM_SIGNAL_TYPES, "instagram_audit", "instagram", async () =>
      discoverInstagram({
        websiteSocialLinks,
        providerProfiles: details.socialProfiles,
        businessName: details.displayName,
        locale,
      }),
    );
    if (outcome.status !== "failed" && outcome.summary !== null) instagramStatus = outcome.summary.status;
    outcomes.push(outcome);
  } else {
    outcomes.push(skippedOutcome("instagram", locale, INSTAGRAM_SIGNAL_TYPES, "instagram_audit", "instagram", "instagram_not_checked"));
  }

  const signals = mergeSignals(outcomes.map((outcome) => outcome.signals));
  const findings = outcomes.flatMap((outcome) => outcome.findings);

  return { outcomes, signals, findings, websiteStatus, instagramStatus };
}

// ---------------------------------------------------------------------------
// isolation helpers
// ---------------------------------------------------------------------------

async function isolate<TSummary>(
  auditType: AuditType,
  locale: Locale,
  signalTypes: readonly string[],
  signalSource: SignalSource,
  source: string,
  run: () => Promise<AuditOutcome<TSummary>>,
): Promise<AuditOutcome<TSummary | null>> {
  const started = Date.now();
  try {
    return await run();
  } catch (error) {
    return failureOutcome(auditType, locale, signalTypes, signalSource, source, error, started);
  }
}

/** A sub-audit that threw still reports: every signal of its area becomes an explicit error. */
function failureOutcome(
  auditType: AuditType,
  locale: Locale,
  signalTypes: readonly string[],
  signalSource: SignalSource,
  source: string,
  error: unknown,
  started: number,
): AuditOutcome<null> {
  const appError = toAppError(error, `${auditType} audit failed`);
  logger.warn("sub_audit_failed", { auditType, code: appError.code, message: appError.message });
  const signals = createSignalFactory(locale, signalSource);
  return {
    auditType,
    status: "failed",
    observation: "error",
    source,
    summary: null,
    findings: [],
    signals: signalTypes.map((type) => signals.unavailable(type, "audit_failed", { status: "error" })),
    durationMs: Date.now() - started,
    errorCode: appError.code,
    errorMessage: appError.message,
  };
}

function skippedOutcome(
  auditType: AuditType,
  locale: Locale,
  signalTypes: readonly string[],
  signalSource: SignalSource,
  source: string,
  reason: UnavailableReason,
): AuditOutcome<null> {
  const signals = createSignalFactory(locale, signalSource);
  return {
    auditType,
    status: "skipped",
    observation: "not_checked",
    source,
    summary: null,
    findings: [],
    signals: signalTypes.map((type) => signals.unavailable(type, reason)),
    durationMs: 0,
  };
}

/**
 * At discovery depth the website is never fetched. The only thing that can be
 * said is whether the provider profile carried a website link — and even that
 * only when the field was inside the requested field mask.
 */
function discoveryWebsiteOutcome(details: PlaceDetails, locale: Locale): AuditOutcome<WebsiteAuditSummary> {
  const signals = createSignalFactory(locale, "provider");
  const checked = providerFieldChecked(details, "websiteUri");
  const hasWebsite = details.websiteUri !== null && details.websiteUri.trim() !== "";
  const websiteStatus: WebsiteStatus = !checked ? "not_checked" : hasWebsite ? "found" : "not_found";

  const emitted: Signal[] = [];
  if (checked) {
    emitted.push(
      signals.emit(SIGNAL_TYPES.WEBSITE_STATUS, websiteStatus, {
        status: hasWebsite ? "found" : "not_found",
        evidenceType: "observed",
        confidence: "high",
      }),
    );
    if (hasWebsite) {
      emitted.push(signals.emit(SIGNAL_TYPES.WEBSITE_URL, details.websiteUri, { confidence: "high" }));
    }
  }
  const reason: UnavailableReason = checked ? "website_discovery_depth" : "google_field_not_requested";
  const present = new Set(emitted.map((signal) => signal.signalType));
  for (const type of WEBSITE_SIGNAL_TYPES) {
    if (!present.has(type)) emitted.push(signals.unavailable(type, reason));
  }

  return {
    auditType: "website",
    status: "skipped",
    observation: checked ? (hasWebsite ? "found" : "not_found") : "not_checked",
    source: "provider",
    summary: {
      websiteStatus,
      inputUrl: details.websiteUri,
      technical: null,
      seo: null,
      ux: null,
      branding: null,
      qualityScore: null,
      quality: null,
      fetchedAt: new Date().toISOString(),
    },
    findings: [],
    signals: emitted,
    durationMs: 0,
  };
}
