import { createFindingCollector } from "@/lib/audits/finding";
import { createSignalFactory, type UnavailableReason } from "@/lib/audits/signal";
import { createLogger } from "@/lib/logging";
import { timedProviderCall } from "@/lib/providers/call-log";
import { classifyFetchError, safeFetchUrl, type SafeFetcher, type SafeFetchResult } from "@/lib/security/safe-fetch";
import { analyzeWebsiteUrl } from "@/lib/security/url";
import type {
  AuditOutcome,
  Finding,
  WebsiteAuditSummary,
  WebsiteSeoSummary,
  WebsiteTechnicalSummary,
  WebsiteUxSummary,
} from "@/types/audits";
import type { AuditDepth, Locale, ObservationStatus } from "@/types/common";
import { SIGNAL_TYPES, type Signal, type WebsiteStatus } from "@/types/signals";

import { parseHtml, type ParsedPage } from "./parse";
import {
  buildBrandingSummary,
  buildSeoSummary,
  buildTechnicalSummary,
  buildUxSummary,
  classifyQuality,
  computeQualityScore,
  EMPTY_EXTRA_CHECKS,
  FAST_RESPONSE_MS,
  MIN_CONTENT_WORDS,
  type ExtraChecks,
  type FetchFacts,
} from "./summary";

/**
 * Website audit. Fetches the homepage through the SSRF-hardened fetcher (or an
 * injected one in demo mode / tests), parses it and turns the observations into
 * signals (machine) and findings (human).
 *
 * Nothing here ever reports `not_found` for something that was not checked: a
 * timeout is `unreachable`, a blocked URL is `invalid`, and every check that did
 * not run is emitted as an unavailable signal explaining why.
 */

const SOURCE = "website";
const logger = createLogger({ module: "audits/website" });

const HOMEPAGE_MAX_BYTES = 1_500_000;
const HOMEPAGE_TIMEOUT_MS = 10_000;
const SUB_REQUEST_TIMEOUT_MS = 6_000;
const SUB_REQUEST_MAX_BYTES = 300_000;
const DEFAULT_BROKEN_LINK_SAMPLE = 5;
const ALT_COVERAGE_THRESHOLD = 0.6;

const WEBSITE_SIGNAL_TYPES: readonly string[] = Object.values(SIGNAL_TYPES).filter((type) => type.startsWith("website."));

export interface AuditWebsiteInput {
  url: string | null;
  businessName: string;
  locale: Locale;
  depth: AuditDepth;
  fetcher?: SafeFetcher;
  /** Defaults to true for `basic` and `deep`. */
  checkSitemapAndRobots?: boolean;
  /** Number of internal links to HEAD at `deep` depth. Defaults to 5. */
  brokenLinkSample?: number;
}

export interface AuditWebsiteResult {
  outcome: AuditOutcome<WebsiteAuditSummary>;
  /** Homepage HTML, reused by the performance audit so nothing is refetched. */
  html: string | null;
  responseTimeMs: number | null;
}

export async function auditWebsite(input: AuditWebsiteInput): Promise<AuditWebsiteResult> {
  const started = Date.now();
  const fetcher = input.fetcher ?? safeFetchUrl;
  const signals = createSignalFactory(input.locale, "website_audit");
  const collector = createFindingCollector(input.locale, SOURCE);

  if (input.url === null || input.url.trim() === "") {
    return { outcome: notFoundOutcome(input, started), html: null, responseTimeMs: null };
  }

  const analysis = analyzeWebsiteUrl(input.url);
  if (!analysis.ok) {
    return {
      outcome: unusableOutcome(input, started, "invalid", "website_invalid", { reason: analysis.reason, url: input.url }),
      html: null,
      responseTimeMs: null,
    };
  }
  const normalizedUrl = analysis.url.toString();

  let response: SafeFetchResult;
  try {
    response = await timedProviderCall(
      { providerName: "website", operation: "fetch_homepage", estimatedCost: 0, requestContext: { host: analysis.url.hostname } },
      () =>
        fetcher(normalizedUrl, {
          method: "GET",
          maxBytes: HOMEPAGE_MAX_BYTES,
          timeoutMs: HOMEPAGE_TIMEOUT_MS,
          truncateInsteadOfFail: true,
        }),
    );
  } catch (error) {
    const kind = classifyFetchError(error);
    const status: WebsiteStatus = kind === "blocked" || kind === "invalid_url" ? "invalid" : "unreachable";
    const findingKey = status === "invalid" ? "website_invalid" : "website_unreachable";
    logger.info("website_fetch_failed", { url: normalizedUrl, kind });
    return {
      outcome: unusableOutcome(input, started, status, findingKey, { url: normalizedUrl, reason: kind }),
      html: null,
      responseTimeMs: null,
    };
  }

  if (!response.ok) {
    return {
      outcome: unusableOutcome(input, started, "unreachable", "website_unreachable", { url: normalizedUrl, statusCode: response.status }, response.status),
      html: null,
      responseTimeMs: response.durationMs,
    };
  }

  // ---- success ------------------------------------------------------------
  const parsed = parseHtml(response.body, response.finalUrl, input.businessName);
  const checkExtras = input.checkSitemapAndRobots ?? input.depth !== "discovery";
  const brokenLinkSample = input.brokenLinkSample ?? (input.depth === "deep" ? DEFAULT_BROKEN_LINK_SAMPLE : 0);

  const extra: ExtraChecks = { ...EMPTY_EXTRA_CHECKS };
  if (checkExtras) {
    const robots = await checkRobots(fetcher, response.finalUrl);
    extra.hasRobotsTxt = robots.found;
    const sitemap = await checkSitemap(fetcher, response.finalUrl, robots.sitemapUrls);
    extra.hasSitemap = sitemap.found;
    extra.sitemapUrl = sitemap.url;
    if (parsed.faviconLinks.length === 0 && parsed.implicitFavicon !== null && input.depth === "deep") {
      extra.implicitFaviconFound = await checkFavicon(fetcher, parsed.implicitFavicon);
    }
  }
  if (brokenLinkSample > 0) {
    const broken = await sampleBrokenLinks(fetcher, parsed.links.internal, response.finalUrl, brokenLinkSample);
    extra.brokenLinksChecked = broken.checked;
    extra.brokenLinksFound = broken.broken;
  }

  const facts: FetchFacts = {
    finalUrl: response.finalUrl,
    https: response.https,
    statusCode: response.status,
    responseTimeMs: response.durationMs,
    redirectChain: response.redirectChain,
  };

  const technical = buildTechnicalSummary(parsed, facts, extra);
  const seo = buildSeoSummary(parsed);
  const ux = buildUxSummary(parsed);
  const branding = buildBrandingSummary(parsed, extra);
  const quality = computeQualityScore(parsed, seo, ux, technical);
  const qualityClass = classifyQuality(quality.score);

  const summary: WebsiteAuditSummary = {
    websiteStatus: "found",
    inputUrl: input.url,
    technical,
    seo,
    ux,
    branding,
    qualityScore: quality.score,
    quality: qualityClass,
    fetchedAt: new Date().toISOString(),
  };

  const emitted = buildSuccessSignals({ signals, parsed, technical, seo, ux, summary, extra, checkExtras, brokenLinkSample });
  const findings = buildSuccessFindings({
    collector,
    parsed,
    technical,
    seo,
    ux,
    summary,
    extra,
    checkExtras,
    quality: qualityClass,
    redirected: crossHostRedirect(normalizedUrl, response),
  });

  return {
    outcome: {
      auditType: "website",
      status: "completed",
      observation: "found",
      source: SOURCE,
      summary,
      findings,
      signals: fillUnavailable(emitted, signals, "website_not_audited"),
      durationMs: Date.now() - started,
    },
    html: response.body,
    responseTimeMs: response.durationMs,
  };
}

// ---------------------------------------------------------------------------
// outcomes for the paths where there is no page to parse
// ---------------------------------------------------------------------------

function emptySummary(input: AuditWebsiteInput, status: WebsiteStatus): WebsiteAuditSummary {
  return {
    websiteStatus: status,
    inputUrl: input.url,
    technical: null,
    seo: null,
    ux: null,
    branding: null,
    qualityScore: null,
    quality: null,
    fetchedAt: new Date().toISOString(),
  };
}

function notFoundOutcome(input: AuditWebsiteInput, started: number): AuditOutcome<WebsiteAuditSummary> {
  const signals = createSignalFactory(input.locale, "website_audit");
  const collector = createFindingCollector(input.locale, SOURCE);

  const emitted: Signal[] = [
    signals.emit(SIGNAL_TYPES.WEBSITE_STATUS, "not_found", { source: "provider", status: "not_found", evidenceType: "observed", confidence: "high" }),
    // Logical consequences of having no website at all, not observations.
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_CTA, false, { source: "derived", evidenceType: "derived", confidence: "medium" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_BOOKING, false, { source: "derived", evidenceType: "derived", confidence: "medium" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_CONTACT_INFO, false, { source: "derived", evidenceType: "derived", confidence: "medium" }),
  ];

  collector.add({
    key: "website_not_found",
    category: "technical",
    severity: "high",
    status: "not_found",
    evidenceType: "observed",
    confidence: "high",
    evidence: { inputUrl: null },
  });

  return {
    auditType: "website",
    status: "completed",
    observation: "not_found",
    source: "provider",
    summary: emptySummary(input, "not_found"),
    findings: collector.findings,
    signals: fillUnavailable(emitted, signals, "website_not_found"),
    durationMs: Date.now() - started,
  };
}

function unusableOutcome(
  input: AuditWebsiteInput,
  started: number,
  websiteStatus: Extract<WebsiteStatus, "invalid" | "unreachable">,
  findingKey: string,
  evidence: Record<string, unknown>,
  statusCode?: number,
): AuditOutcome<WebsiteAuditSummary> {
  const signals = createSignalFactory(input.locale, "website_audit");
  const collector = createFindingCollector(input.locale, SOURCE);
  const reason: UnavailableReason = websiteStatus === "invalid" ? "website_invalid" : "website_not_reachable";
  const observation: ObservationStatus = websiteStatus === "invalid" ? "error" : "unavailable";

  const emitted: Signal[] = [
    // The value is an observation about the check itself ("the URL did not
    // answer"), so it is evaluable; it is never reported as "no website".
    signals.emit(SIGNAL_TYPES.WEBSITE_STATUS, websiteStatus, { evidenceType: "observed", confidence: "medium" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_URL, input.url, { evidenceType: "observed", confidence: "high" }),
  ];
  if (statusCode !== undefined) {
    emitted.push(signals.emit(SIGNAL_TYPES.WEBSITE_STATUS_CODE, statusCode, { evidenceType: "observed", confidence: "high" }));
  }

  collector.add({
    key: findingKey,
    category: "technical",
    severity: "medium",
    status: websiteStatus === "invalid" ? "error" : "unavailable",
    evidenceType: "observed",
    confidence: "medium",
    evidence,
    params: { url: String(input.url ?? "") },
  });

  return {
    auditType: "website",
    status: "completed",
    observation,
    source: SOURCE,
    summary: emptySummary(input, websiteStatus),
    findings: collector.findings,
    signals: fillUnavailable(emitted, signals, reason),
    durationMs: Date.now() - started,
  };
}

/** Every website signal type that was not emitted becomes an explicit "not checked". */
function fillUnavailable(emitted: readonly Signal[], signals: ReturnType<typeof createSignalFactory>, reason: UnavailableReason): Signal[] {
  const present = new Set(emitted.map((signal) => signal.signalType));
  const filled = [...emitted];
  for (const type of WEBSITE_SIGNAL_TYPES) {
    if (!present.has(type)) filled.push(signals.unavailable(type, reason));
  }
  return filled;
}

// ---------------------------------------------------------------------------
// signals for a parsed page
// ---------------------------------------------------------------------------

interface SuccessInput {
  signals: ReturnType<typeof createSignalFactory>;
  parsed: ParsedPage;
  technical: WebsiteTechnicalSummary;
  seo: WebsiteSeoSummary;
  ux: WebsiteUxSummary;
  summary: WebsiteAuditSummary;
  extra: ExtraChecks;
  checkExtras: boolean;
  brokenLinkSample: number;
}

function buildSuccessSignals({ signals, parsed, technical, seo, ux, summary, extra, checkExtras, brokenLinkSample }: SuccessInput): Signal[] {
  const altCoverage = parsed.images.total === 0 ? 1 : Math.round((parsed.images.withAlt / parsed.images.total) * 100) / 100;

  const out: Signal[] = [
    signals.emit(SIGNAL_TYPES.WEBSITE_STATUS, "found", { confidence: "high" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_URL, technical.finalUrl, { confidence: "high" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HTTPS, technical.https, { confidence: "high" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_RESPONSE_TIME_MS, technical.responseTimeMs, { confidence: "high" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_STATUS_CODE, technical.statusCode, { confidence: "high" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_META_TITLE, seo.title !== null, { confidence: "high" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_TITLE_QUALITY, seo.titleQuality, { confidence: "medium", params: { length: seo.titleLength } }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_META_DESCRIPTION, seo.metaDescription !== null, { confidence: "high" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_DESCRIPTION_QUALITY, seo.descriptionQuality, { confidence: "medium", params: { length: seo.metaDescriptionLength } }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_H1, seo.h1Count > 0, { confidence: "high", params: { count: seo.h1Count } }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HEADING_STRUCTURE_OK, seo.headingStructureOk, { confidence: "medium", params: { h1: seo.h1Count, h2: seo.h2Count } }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_VIEWPORT, technical.hasViewport === true, { confidence: "high" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_CANONICAL, technical.hasCanonical === true, { confidence: "high" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_SCHEMA, technical.hasSchemaOrg === true, { confidence: "high", params: { types: technical.schemaTypes.join(", ") } }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_OPEN_GRAPH, technical.hasOpenGraph === true, { confidence: "high" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_IMAGE_ALT_COVERAGE, altCoverage, { confidence: "high", params: { withAlt: parsed.images.withAlt, total: parsed.images.total } }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_CTA, ux.hasVisibleCta, { confidence: "medium", params: { samples: ux.ctaSamples.join(", ") } }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_CONTACT_INFO, ux.hasContactInfo, { confidence: "medium" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_PHONE, ux.hasPhone, { confidence: "medium" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_ADDRESS, ux.hasAddress, { confidence: "medium" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_OPENING_HOURS, ux.hasOpeningHours, { confidence: "medium" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_BOOKING, ux.hasBooking, { confidence: "medium" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_MENU, ux.hasMenu, { confidence: "medium" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_WHATSAPP, ux.hasWhatsApp, { confidence: "high" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_HAS_SOCIAL_LINKS, ux.socialLinks.length > 0, { confidence: "high", params: { count: ux.socialLinks.length } }),
    signals.emit(SIGNAL_TYPES.WEBSITE_LANGUAGE_DECLARED, parsed.languageDeclared, { confidence: "high", params: { lang: parsed.lang ?? "" } }),
    // Heuristic: viewport + no fixed desktop width is an indication, not a test.
    signals.emit(SIGNAL_TYPES.WEBSITE_MOBILE_FRIENDLY, technical.mobileFriendlyHeuristic === true, { evidenceType: "heuristic", confidence: "low" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_QUALITY, summary.quality, { evidenceType: "derived", confidence: "medium" }),
    signals.emit(SIGNAL_TYPES.WEBSITE_QUALITY_SCORE, summary.qualityScore, { evidenceType: "derived", confidence: "medium" }),
  ];

  if (checkExtras) {
    out.push(signals.emit(SIGNAL_TYPES.WEBSITE_HAS_ROBOTS, extra.hasRobotsTxt === true, { confidence: "high" }));
    out.push(signals.emit(SIGNAL_TYPES.WEBSITE_HAS_SITEMAP, extra.hasSitemap === true, { confidence: "high" }));
  } else {
    out.push(signals.unavailable(SIGNAL_TYPES.WEBSITE_HAS_ROBOTS, "robots_not_checked"));
    out.push(signals.unavailable(SIGNAL_TYPES.WEBSITE_HAS_SITEMAP, "robots_not_checked"));
  }

  if (parsed.faviconLinks.length > 0 || extra.implicitFaviconFound !== null) {
    out.push(signals.emit(SIGNAL_TYPES.WEBSITE_HAS_FAVICON, technical.hasFavicon === true, { confidence: "high" }));
  } else {
    // No icon link element in the markup. The default /favicon.ico path was not
    // requested, so this is a markup observation, not a proof of absence.
    out.push(signals.emit(SIGNAL_TYPES.WEBSITE_HAS_FAVICON, false, { evidenceType: "derived", confidence: "low" }));
  }

  if (brokenLinkSample > 0) {
    out.push(
      signals.emit(SIGNAL_TYPES.WEBSITE_BROKEN_LINKS_COUNT, extra.brokenLinksFound, { confidence: "medium", params: { checked: extra.brokenLinksChecked } }),
    );
  } else {
    out.push(signals.unavailable(SIGNAL_TYPES.WEBSITE_BROKEN_LINKS_COUNT, "broken_links_not_checked"));
  }

  return out;
}

// ---------------------------------------------------------------------------
// findings for a parsed page
// ---------------------------------------------------------------------------

interface FindingsInput {
  collector: ReturnType<typeof createFindingCollector>;
  parsed: ParsedPage;
  technical: WebsiteTechnicalSummary;
  seo: WebsiteSeoSummary;
  ux: WebsiteUxSummary;
  summary: WebsiteAuditSummary;
  extra: ExtraChecks;
  checkExtras: boolean;
  quality: NonNullable<WebsiteAuditSummary["quality"]>;
  redirected: string[] | null;
}

function buildSuccessFindings({ collector, parsed, technical, seo, ux, summary, extra, checkExtras, quality, redirected }: FindingsInput): Finding[] {
  if (redirected !== null) {
    collector.add({
      key: "website_redirected",
      category: "technical",
      severity: "info",
      confidence: "high",
      evidence: { redirectChain: redirected, finalUrl: technical.finalUrl },
      params: { finalUrl: technical.finalUrl },
    });
  }

  if (technical.https === false) {
    collector.add({ key: "website_no_https", category: "technical", severity: "high", confidence: "high", evidence: { finalUrl: technical.finalUrl } });
  }
  if (seo.titleQuality === "missing") {
    collector.add({ key: "website_missing_title", category: "seo", severity: "high", status: "not_found", confidence: "high", evidence: {} });
  } else if (seo.titleQuality === "weak") {
    collector.add({ key: "website_weak_title", category: "seo", severity: "low", confidence: "medium", evidence: { title: seo.title, length: seo.titleLength }, params: { length: seo.titleLength } });
  }
  if (seo.descriptionQuality === "missing") {
    collector.add({ key: "website_missing_meta_description", category: "seo", severity: "medium", status: "not_found", confidence: "high", evidence: {} });
  } else if (seo.descriptionQuality === "weak") {
    collector.add({
      key: "website_weak_meta_description",
      category: "seo",
      severity: "low",
      confidence: "medium",
      evidence: { length: seo.metaDescriptionLength },
      params: { length: seo.metaDescriptionLength },
    });
  }
  if (seo.h1Count === 0) {
    collector.add({ key: "website_missing_h1", category: "seo", severity: "medium", status: "not_found", confidence: "high", evidence: {} });
  } else if (!seo.headingStructureOk) {
    collector.add({ key: "website_heading_structure", category: "seo", severity: "low", confidence: "medium", evidence: { h1Count: seo.h1Count, h2Count: seo.h2Count }, params: { h1: seo.h1Count, h2: seo.h2Count } });
  }
  if (technical.hasViewport !== true) {
    collector.add({ key: "website_missing_viewport", category: "technical", severity: "high", status: "not_found", confidence: "high", evidence: {} });
  }
  if (technical.hasCanonical !== true) {
    collector.add({ key: "website_missing_canonical", category: "seo", severity: "low", status: "not_found", confidence: "high", evidence: {} });
  }
  if (technical.hasSchemaOrg !== true) {
    collector.add({ key: "website_missing_schema", category: "seo", severity: "medium", status: "not_found", confidence: "high", evidence: {} });
  }
  if (technical.hasOpenGraph !== true) {
    collector.add({ key: "website_missing_open_graph", category: "branding", severity: "low", status: "not_found", confidence: "high", evidence: {} });
  }
  if (technical.hasFavicon !== true) {
    collector.add({
      key: "website_missing_favicon",
      category: "branding",
      severity: "low",
      status: extra.implicitFaviconFound === false ? "not_found" : "found",
      evidenceType: extra.implicitFaviconFound === null ? "derived" : "observed",
      confidence: extra.implicitFaviconFound === null ? "low" : "high",
      evidence: { checkedDefaultPath: extra.implicitFaviconFound !== null },
    });
  }
  if (checkExtras && extra.hasRobotsTxt === false) {
    collector.add({ key: "website_missing_robots", category: "seo", severity: "low", status: "not_found", confidence: "high", evidence: {} });
  }
  if (checkExtras && extra.hasSitemap === false) {
    collector.add({ key: "website_missing_sitemap", category: "seo", severity: "low", status: "not_found", confidence: "high", evidence: {} });
  }
  if (parsed.images.total > 0 && parsed.images.withAlt / parsed.images.total < ALT_COVERAGE_THRESHOLD) {
    collector.add({
      key: "website_low_alt_coverage",
      category: "seo",
      severity: "low",
      confidence: "high",
      evidence: { total: parsed.images.total, withAlt: parsed.images.withAlt },
      params: { withAlt: parsed.images.withAlt, total: parsed.images.total },
    });
  }
  if (!ux.hasVisibleCta) {
    collector.add({ key: "website_missing_cta", category: "ux", severity: "high", status: "not_found", confidence: "medium", evidence: {} });
  }
  if (!ux.hasContactInfo) {
    collector.add({ key: "website_missing_contact_info", category: "ux", severity: "high", status: "not_found", confidence: "medium", evidence: {} });
  }
  if (!ux.hasBooking) {
    collector.add({ key: "website_missing_booking", category: "ux", severity: "low", status: "not_found", confidence: "medium", evidence: {} });
  }
  if (ux.socialLinks.length === 0) {
    collector.add({ key: "website_missing_social_links", category: "social", severity: "medium", status: "not_found", confidence: "high", evidence: {} });
  }
  if (technical.mobileFriendlyHeuristic !== true) {
    collector.add({
      key: "website_not_mobile_friendly",
      category: "ux",
      severity: "high",
      evidenceType: "heuristic",
      confidence: "low",
      evidence: { hasViewport: technical.hasViewport, fixedWidthLayout: parsed.hasFixedWidthLayout },
    });
  }
  if (technical.responseTimeMs !== null && technical.responseTimeMs >= FAST_RESPONSE_MS) {
    collector.add({
      key: "website_slow_response",
      category: "performance",
      severity: "medium",
      confidence: "high",
      evidence: { responseTimeMs: technical.responseTimeMs },
      params: { ms: technical.responseTimeMs },
    });
  }
  if (seo.wordCount < MIN_CONTENT_WORDS) {
    collector.add({ key: "website_thin_content", category: "seo", severity: "low", confidence: "high", evidence: { wordCount: seo.wordCount }, params: { count: seo.wordCount } });
  }
  if (!parsed.languageDeclared) {
    collector.add({ key: "website_missing_language", category: "technical", severity: "low", status: "not_found", confidence: "high", evidence: {} });
  }
  if (extra.brokenLinksFound > 0) {
    collector.add({
      key: "website_broken_links",
      category: "technical",
      severity: "medium",
      confidence: "high",
      evidence: { checked: extra.brokenLinksChecked, broken: extra.brokenLinksFound },
      params: { broken: extra.brokenLinksFound, checked: extra.brokenLinksChecked },
    });
  }
  if (quality === "weak") {
    collector.add({
      key: "website_quality_weak",
      category: "general",
      severity: "high",
      evidenceType: "derived",
      confidence: "medium",
      evidence: { qualityScore: summary.qualityScore },
      params: { score: summary.qualityScore ?? 0 },
    });
  }

  return collector.findings;
}

// ---------------------------------------------------------------------------
// secondary requests
// ---------------------------------------------------------------------------

function crossHostRedirect(requestedUrl: string, response: SafeFetchResult): string[] | null {
  try {
    const from = new URL(requestedUrl).hostname.toLowerCase().replace(/^www\./, "");
    const to = new URL(response.finalUrl).hostname.toLowerCase().replace(/^www\./, "");
    if (from === to) return null;
    return response.redirectChain.length > 0 ? response.redirectChain : [requestedUrl, response.finalUrl];
  } catch {
    return null;
  }
}

async function checkRobots(fetcher: SafeFetcher, finalUrl: string): Promise<{ found: boolean; sitemapUrls: string[] }> {
  const robotsUrl = resolveFrom(finalUrl, "/robots.txt");
  if (robotsUrl === null) return { found: false, sitemapUrls: [] };
  try {
    const result = await fetcher(robotsUrl, { method: "GET", maxBytes: SUB_REQUEST_MAX_BYTES, timeoutMs: SUB_REQUEST_TIMEOUT_MS, truncateInsteadOfFail: true });
    if (!result.ok) return { found: false, sitemapUrls: [] };
    const sitemapUrls: string[] = [];
    for (const line of result.body.split(/\r?\n/)) {
      const match = /^\s*sitemap\s*:\s*(\S+)\s*$/i.exec(line);
      if (match !== null) sitemapUrls.push(match[1]);
    }
    return { found: true, sitemapUrls };
  } catch (error) {
    logger.debug("robots_check_failed", { url: robotsUrl, kind: classifyFetchError(error) });
    return { found: false, sitemapUrls: [] };
  }
}

async function checkSitemap(fetcher: SafeFetcher, finalUrl: string, declared: readonly string[]): Promise<{ found: boolean; url: string | null }> {
  const candidates: string[] = [];
  for (const raw of declared) {
    const resolved = resolveFrom(finalUrl, raw);
    if (resolved !== null && !candidates.includes(resolved)) candidates.push(resolved);
  }
  const fallback = resolveFrom(finalUrl, "/sitemap.xml");
  if (fallback !== null && !candidates.includes(fallback)) candidates.push(fallback);

  for (const candidate of candidates.slice(0, 3)) {
    try {
      const result = await fetcher(candidate, { method: "GET", maxBytes: SUB_REQUEST_MAX_BYTES, timeoutMs: SUB_REQUEST_TIMEOUT_MS, truncateInsteadOfFail: true });
      if (!result.ok) continue;
      const head = result.body.slice(0, 2000).toLowerCase();
      if (head.includes("<urlset") || head.includes("<sitemapindex") || head.includes("<?xml")) return { found: true, url: candidate };
    } catch (error) {
      logger.debug("sitemap_check_failed", { url: candidate, kind: classifyFetchError(error) });
    }
  }
  return { found: false, url: null };
}

async function checkFavicon(fetcher: SafeFetcher, faviconUrl: string): Promise<boolean | null> {
  try {
    const result = await fetcher(faviconUrl, { method: "HEAD", timeoutMs: SUB_REQUEST_TIMEOUT_MS, maxBytes: SUB_REQUEST_MAX_BYTES });
    return result.ok;
  } catch {
    return null;
  }
}

async function sampleBrokenLinks(
  fetcher: SafeFetcher,
  internalLinks: readonly string[],
  finalUrl: string,
  sampleSize: number,
): Promise<{ checked: number; broken: number }> {
  const targets = internalLinks.filter((link) => link !== finalUrl).slice(0, sampleSize);
  let checked = 0;
  let broken = 0;
  for (const target of targets) {
    try {
      const result = await fetcher(target, { method: "HEAD", timeoutMs: SUB_REQUEST_TIMEOUT_MS, maxRedirects: 3, maxBytes: SUB_REQUEST_MAX_BYTES });
      checked += 1;
      if (result.status >= 400) broken += 1;
    } catch (error) {
      // A link we could not reach is not proof that it is broken.
      logger.debug("link_check_failed", { url: target, kind: classifyFetchError(error) });
    }
  }
  return { checked, broken };
}

function resolveFrom(baseUrl: string, path: string): string | null {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return null;
  }
}
