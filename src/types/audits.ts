import type { ConfidenceLevel, EvidenceType, ObservationStatus } from "./common";
import type { Signal, WebsiteStatus } from "./signals";

export type AuditType = "website" | "google_business" | "instagram" | "performance" | "competitor";

export type FindingCategory =
  | "technical"
  | "seo"
  | "performance"
  | "ux"
  | "social"
  | "google"
  | "branding"
  | "general";

export type FindingSeverity = "info" | "low" | "medium" | "high";

/**
 * A human-facing finding. Findings are what the UI and reports show; signals are
 * what the scoring engine consumes. One audit produces both.
 */
export interface Finding {
  key: string; // e.g. "website.missing_meta_description"
  category: FindingCategory;
  severity: FindingSeverity;
  status: ObservationStatus;
  evidenceType: EvidenceType;
  confidence: ConfidenceLevel;
  title: string;
  explanation?: string;
  whyItMatters?: string;
  evidence: Record<string, unknown>;
  source: string;
  detectedAt: string;
}

export interface AuditOutcome<TSummary> {
  auditType: AuditType;
  status: "completed" | "failed" | "skipped" | "unavailable";
  observation?: ObservationStatus;
  source: string;
  summary: TSummary;
  findings: Finding[];
  signals: Signal[];
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Website audit
// ---------------------------------------------------------------------------
export interface WebsiteTechnicalSummary {
  finalUrl: string | null;
  https: boolean | null;
  statusCode: number | null;
  responseTimeMs: number | null;
  redirectChain: string[];
  hasCanonical: boolean | null;
  canonicalUrl: string | null;
  hasRobotsTxt: boolean | null;
  hasSitemap: boolean | null;
  hasViewport: boolean | null;
  languageDeclared: string | null;
  hasFavicon: boolean | null;
  hasOpenGraph: boolean | null;
  hasSchemaOrg: boolean | null;
  schemaTypes: string[];
  imageCount: number;
  imagesWithAlt: number;
  brokenLinksChecked: number;
  brokenLinksFound: number;
  mobileFriendlyHeuristic: boolean | null;
}

export interface WebsiteSeoSummary {
  title: string | null;
  titleLength: number;
  titleQuality: "good" | "weak" | "missing";
  metaDescription: string | null;
  metaDescriptionLength: number;
  descriptionQuality: "good" | "weak" | "missing";
  h1Count: number;
  h2Count: number;
  headingStructureOk: boolean;
  indexable: boolean | null; // robots meta / noindex hints
  wordCount: number;
}

export interface WebsiteUxSummary {
  hasVisibleCta: boolean;
  ctaSamples: string[];
  hasContactInfo: boolean;
  hasPhone: boolean;
  phoneSamples: string[];
  hasEmail: boolean;
  hasAddress: boolean;
  hasOpeningHours: boolean;
  hasBooking: boolean;
  hasReservation: boolean;
  hasMenu: boolean;
  hasWhatsApp: boolean;
  socialLinks: { platform: string; url: string }[];
}

export interface WebsiteBrandingSummary {
  hasLogoSignal: boolean;
  logoUrl: string | null;
  nameConsistency: boolean | null;
  consistencyScore: number; // 0-100 heuristic
}

export interface WebsiteAuditSummary {
  websiteStatus: WebsiteStatus;
  inputUrl: string | null;
  technical: WebsiteTechnicalSummary | null;
  seo: WebsiteSeoSummary | null;
  ux: WebsiteUxSummary | null;
  branding: WebsiteBrandingSummary | null;
  qualityScore: number | null; // 0-100 derived
  quality: "weak" | "average" | "strong" | null;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Performance audit
// ---------------------------------------------------------------------------
export interface PerformanceAuditSummary {
  source: "pagespeed" | "heuristic";
  isHeuristic: boolean;
  mobileScore: number | null;
  desktopScore: number | null;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  mobileGrade: "poor" | "needs_improvement" | "good" | null;
  measuredAt: string;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Google Business audit
// ---------------------------------------------------------------------------
export interface GoogleBusinessAuditSummary {
  rating: number | null;
  reviewCount: number | null;
  hasOpeningHours: boolean | null;
  photoCount: number | null;
  hasWebsite: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
  businessStatus: string | null;
  completenessScore: number; // 0-100 derived
  completeness: "complete" | "incomplete";
  missingFields: string[];
  reviewSample: {
    size: number;
    withOwnerReply: number;
    responseRate: number | null; // 0-1
    recentUnanswered: number;
    confidence: ConfidenceLevel;
  } | null;
  mapsUrl: string | null;
}

// ---------------------------------------------------------------------------
// Instagram audit (conservative)
// ---------------------------------------------------------------------------
export interface InstagramAuditSummary {
  status: ObservationStatus;
  profileUrl: string | null;
  handle: string | null;
  discoveredVia: "website" | "provider" | "manual" | null;
  lastActivitySignal: string | null; // ISO date if known
  daysSinceLastPost: number | null;
  isActive: boolean | null;
  hasWebsiteLink: boolean | null;
  bioComplete: boolean | null;
  followerCount: number | null;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Competitor benchmark
// ---------------------------------------------------------------------------
export interface BenchmarkMetrics {
  hasWebsite: boolean | null;
  websiteQuality: "weak" | "average" | "strong" | null;
  rating: number | null;
  reviewCount: number | null;
  hasInstagram: boolean | null;
  photoCount: number | null;
  hasOpeningHours: boolean | null;
}

export interface CompetitorBenchmarkSummary {
  categoryKey: string | null;
  radiusM: number;
  current: BenchmarkMetrics;
  competitors: Array<{
    providerPlaceId: string;
    displayName: string;
    distanceM: number | null;
    metrics: BenchmarkMetrics;
  }>;
  comparisons: Array<{
    metric: keyof BenchmarkMetrics;
    statement: string; // neutral wording, e.g. "Competitor A has a website while the current business does not."
  }>;
  generatedAt: string;
}
