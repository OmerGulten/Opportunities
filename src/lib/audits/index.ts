/**
 * Public surface of the audits module. Workflow steps and feature services
 * should import from here; the per-file paths stay importable for tests.
 */

export { auditWebsite, type AuditWebsiteInput, type AuditWebsiteResult } from "./website/audit";
export { parseHtml, foldText, byteLength, type ParsedPage, type ParsedLinks, type ParsedHint, type SocialLink, type SocialPlatform } from "./website/parse";
export {
  buildBrandingSummary,
  buildSeoSummary,
  buildTechnicalSummary,
  buildUxSummary,
  classifyDescription,
  classifyQuality,
  classifyTitle,
  computeQualityScore,
  hasFavicon,
  titleH1Coherence,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  FAST_RESPONSE_MS,
  MIN_CONTENT_WORDS,
  STRONG_QUALITY_MIN,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
  WEAK_QUALITY_MAX,
  type ExtraChecks,
  type FetchFacts,
  type QualityBreakdown,
} from "./website/summary";

export { auditGoogleBusiness, providerFieldChecked, summarizeReviewSample, PROVIDER_PHOTO_CAP, type GoogleBusinessAuditOptions } from "./google-business/audit";
export { discoverInstagram, handleMatchesName, parseInstagramHandle, type InstagramDiscoveryInput } from "./instagram/discover";
export { performanceSignals, gradeForScore, GOOD_SCORE_MIN, POOR_SCORE_MAX } from "./performance/signals";
export { brandingSignals, LOW_CONSISTENCY_SCORE } from "./branding/derive";
export { buildCompetitorBenchmark, competitorLabel, metricsFromDetails, type BenchmarkInput, type CompetitorInput } from "./competitor/benchmark";
export { runBusinessAudit, type BusinessAuditBundle, type RunBusinessAuditInput } from "./run-business-audit";
export {
  toAuditRows,
  type AuditFindingInsert,
  type AuditRowIds,
  type AuditRows,
  type BusinessAuditInsert,
  type OpportunitySignalInsert,
} from "./mappers";
export { createFindingCollector, findingsT, makeFinding, type FindingInput } from "./finding";
export {
  createSignalFactory,
  mergeSignals,
  signalMessageKey,
  UNAVAILABLE_REASONS,
  type EmitOptions,
  type SignalFactory,
  type UnavailableReason,
} from "./signal";
