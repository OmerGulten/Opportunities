import type { ConfidenceLevel, EvidenceType, ObservationStatus } from "./common";

/**
 * Canonical signal types. Audits emit these; service_rules reference them by
 * string. Adding a signal here does not require a migration, but rules must use
 * the exact string.
 */
export const SIGNAL_TYPES = {
  // Website presence & quality
  WEBSITE_STATUS: "website.status", // WebsiteStatus
  WEBSITE_URL: "website.url",
  WEBSITE_QUALITY: "website.quality", // "weak" | "average" | "strong"
  WEBSITE_QUALITY_SCORE: "website.quality_score", // 0-100 derived
  WEBSITE_HTTPS: "website.https",
  WEBSITE_RESPONSE_TIME_MS: "website.response_time_ms",
  WEBSITE_STATUS_CODE: "website.status_code",
  WEBSITE_HAS_META_TITLE: "website.has_meta_title",
  WEBSITE_TITLE_QUALITY: "website.title_quality", // "good" | "weak" | "missing"
  WEBSITE_HAS_META_DESCRIPTION: "website.has_meta_description",
  WEBSITE_DESCRIPTION_QUALITY: "website.description_quality",
  WEBSITE_HAS_H1: "website.has_h1",
  WEBSITE_HEADING_STRUCTURE_OK: "website.heading_structure_ok",
  WEBSITE_HAS_VIEWPORT: "website.has_viewport",
  WEBSITE_HAS_CANONICAL: "website.has_canonical",
  WEBSITE_HAS_SCHEMA: "website.has_schema",
  WEBSITE_HAS_OPEN_GRAPH: "website.has_open_graph",
  WEBSITE_HAS_FAVICON: "website.has_favicon",
  WEBSITE_HAS_SITEMAP: "website.has_sitemap",
  WEBSITE_HAS_ROBOTS: "website.has_robots",
  WEBSITE_IMAGE_ALT_COVERAGE: "website.image_alt_coverage", // 0-1
  WEBSITE_HAS_CTA: "website.has_cta",
  WEBSITE_HAS_CONTACT_INFO: "website.has_contact_info",
  WEBSITE_HAS_PHONE: "website.has_phone",
  WEBSITE_HAS_ADDRESS: "website.has_address",
  WEBSITE_HAS_OPENING_HOURS: "website.has_opening_hours",
  WEBSITE_HAS_BOOKING: "website.has_booking",
  WEBSITE_HAS_MENU: "website.has_menu",
  WEBSITE_HAS_WHATSAPP: "website.has_whatsapp",
  WEBSITE_HAS_SOCIAL_LINKS: "website.has_social_links",
  WEBSITE_MOBILE_FRIENDLY: "website.mobile_friendly",
  WEBSITE_LANGUAGE_DECLARED: "website.language_declared",
  WEBSITE_BROKEN_LINKS_COUNT: "website.broken_links_count",

  // Performance
  PERFORMANCE_MOBILE_SCORE: "performance.mobile_score",
  PERFORMANCE_DESKTOP_SCORE: "performance.desktop_score",
  PERFORMANCE_LCP_MS: "performance.lcp_ms",
  PERFORMANCE_CLS: "performance.cls",
  PERFORMANCE_INP_MS: "performance.inp_ms",
  PERFORMANCE_MOBILE_GRADE: "performance.mobile_grade", // "poor" | "needs_improvement" | "good"

  // Instagram
  INSTAGRAM_STATUS: "instagram.status", // ObservationStatus
  INSTAGRAM_PROFILE_URL: "instagram.profile_url",
  INSTAGRAM_DAYS_SINCE_LAST_POST: "instagram.days_since_last_post",
  INSTAGRAM_IS_ACTIVE: "instagram.is_active",
  INSTAGRAM_HAS_WEBSITE_LINK: "instagram.has_website_link",
  INSTAGRAM_BIO_COMPLETE: "instagram.bio_complete",
  INSTAGRAM_FOLLOWER_COUNT: "instagram.follower_count",

  // Google Business Profile
  GOOGLE_RATING: "google.rating",
  GOOGLE_REVIEW_COUNT: "google.review_count",
  GOOGLE_HAS_OPENING_HOURS: "google.has_opening_hours",
  GOOGLE_PHOTO_COUNT: "google.photo_count",
  GOOGLE_HAS_WEBSITE: "google.has_website",
  GOOGLE_HAS_PHONE: "google.has_phone",
  GOOGLE_BUSINESS_STATUS: "google.business_status",
  GOOGLE_PROFILE_COMPLETENESS: "google.profile_completeness", // "complete" | "incomplete"
  GOOGLE_COMPLETENESS_SCORE: "google.completeness_score", // 0-100 derived
  GOOGLE_REVIEW_RESPONSE_RATE: "google.review_response_rate", // 0-1 from sample (low confidence)
  GOOGLE_RECENT_UNANSWERED_REVIEWS: "google.recent_unanswered_reviews",
  GOOGLE_REVIEW_SAMPLE_SIZE: "google.review_sample_size",

  // Branding (heuristic)
  BRANDING_HAS_LOGO_SIGNAL: "branding.has_logo_signal",
  BRANDING_NAME_CONSISTENCY: "branding.name_consistency",
  BRANDING_CONSISTENCY_SCORE: "branding.consistency_score", // 0-100 heuristic
} as const;

export type SignalType = (typeof SIGNAL_TYPES)[keyof typeof SIGNAL_TYPES];

export type SignalSource =
  | "provider"
  | "website_audit"
  | "google_audit"
  | "instagram_audit"
  | "performance"
  | "derived"
  | "heuristic"
  | "manual";

export type WebsiteStatus =
  | "found"
  | "not_found"
  | "unreachable"
  | "redirected"
  | "invalid"
  | "not_checked";

export type WebsiteQuality = "weak" | "average" | "strong";

export type SignalValue = string | number | boolean | null | Record<string, unknown>;

/**
 * A single observable fact about a business. Every score is built from these.
 */
export interface Signal {
  signalType: SignalType | string;
  source: SignalSource;
  status: ObservationStatus;
  evidenceType: EvidenceType;
  confidence: ConfidenceLevel;
  value: SignalValue;
  explanation: string;
  detectedAt: string; // ISO timestamp
}

/** Convenience constructor used by audits. */
export function makeSignal(
  signalType: SignalType | string,
  value: SignalValue,
  opts: Partial<Omit<Signal, "signalType" | "value">> & { explanation: string; source: SignalSource },
): Signal {
  return {
    signalType,
    value,
    source: opts.source,
    status: opts.status ?? "found",
    evidenceType: opts.evidenceType ?? "observed",
    confidence: opts.confidence ?? "medium",
    explanation: opts.explanation,
    detectedAt: opts.detectedAt ?? new Date().toISOString(),
  };
}

/** A signal whose value could not be established. Never treated as `not_found`. */
export function makeUnavailableSignal(
  signalType: SignalType | string,
  opts: { source: SignalSource; explanation: string; status?: Extract<ObservationStatus, "not_checked" | "unavailable" | "error"> },
): Signal {
  return {
    signalType,
    value: null,
    source: opts.source,
    status: opts.status ?? "not_checked",
    evidenceType: "unavailable",
    confidence: "low",
    explanation: opts.explanation,
    detectedAt: new Date().toISOString(),
  };
}
