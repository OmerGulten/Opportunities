import type {
  WebsiteAuditSummary,
  WebsiteBrandingSummary,
  WebsiteSeoSummary,
  WebsiteTechnicalSummary,
  WebsiteUxSummary,
} from "@/types/audits";

import { foldText, type ParsedPage } from "./parse";

/**
 * Pure derivation of the website summaries and of the quality score. Kept apart
 * from `audit.ts` so the scoring rules can be unit-tested without a fetcher.
 */

const GENERIC_TITLES = new Set([
  "home",
  "homepage",
  "index",
  "anasayfa",
  "ana sayfa",
  "welcome",
  "hos geldiniz",
  "hosgeldiniz",
  "untitled",
  "untitled document",
  "yeni sayfa",
  "new page",
  "default",
  "site",
  "web sitesi",
  "website",
]);

export const TITLE_MIN_LENGTH = 15;
export const TITLE_MAX_LENGTH = 70;
export const DESCRIPTION_MIN_LENGTH = 50;
export const DESCRIPTION_MAX_LENGTH = 160;
export const FAST_RESPONSE_MS = 1500;
export const MIN_CONTENT_WORDS = 150;
export const WEAK_QUALITY_MAX = 45;
export const STRONG_QUALITY_MIN = 70;

export function classifyTitle(title: string | null): WebsiteSeoSummary["titleQuality"] {
  if (title === null || title.trim() === "") return "missing";
  const trimmed = title.trim();
  if (GENERIC_TITLES.has(foldText(trimmed))) return "weak";
  if (trimmed.length < TITLE_MIN_LENGTH || trimmed.length > TITLE_MAX_LENGTH) return "weak";
  return "good";
}

export function classifyDescription(description: string | null): WebsiteSeoSummary["descriptionQuality"] {
  if (description === null || description.trim() === "") return "missing";
  const length = description.trim().length;
  return length >= DESCRIPTION_MIN_LENGTH && length <= DESCRIPTION_MAX_LENGTH ? "good" : "weak";
}

export function classifyQuality(score: number): NonNullable<WebsiteAuditSummary["quality"]> {
  if (score < WEAK_QUALITY_MAX) return "weak";
  return score > STRONG_QUALITY_MIN ? "strong" : "average";
}

function significantTokens(text: string): string[] {
  return foldText(text)
    .split(" ")
    .filter((token) => token.length >= 4);
}

/** The title and the first H1 talk about the same thing (shared significant token). */
export function titleH1Coherence(title: string | null, h1s: readonly string[]): boolean {
  if (title === null || h1s.length === 0) return false;
  const titleTokens = new Set(significantTokens(title));
  if (titleTokens.size === 0) return false;
  return significantTokens(h1s[0]).some((token) => titleTokens.has(token));
}

export interface ExtraChecks {
  hasRobotsTxt: boolean | null;
  hasSitemap: boolean | null;
  sitemapUrl: string | null;
  brokenLinksChecked: number;
  brokenLinksFound: number;
  /** Result of a HEAD on the implicit /favicon.ico, when it was performed. */
  implicitFaviconFound: boolean | null;
}

export const EMPTY_EXTRA_CHECKS: ExtraChecks = {
  hasRobotsTxt: null,
  hasSitemap: null,
  sitemapUrl: null,
  brokenLinksChecked: 0,
  brokenLinksFound: 0,
  implicitFaviconFound: null,
};

export interface FetchFacts {
  finalUrl: string;
  https: boolean;
  statusCode: number;
  responseTimeMs: number;
  redirectChain: string[];
}

export function hasFavicon(parsed: ParsedPage, extra: ExtraChecks): boolean {
  if (parsed.faviconLinks.length > 0) return true;
  return extra.implicitFaviconFound === true;
}

export function buildTechnicalSummary(parsed: ParsedPage, facts: FetchFacts, extra: ExtraChecks): WebsiteTechnicalSummary {
  return {
    finalUrl: facts.finalUrl,
    https: facts.https,
    statusCode: facts.statusCode,
    responseTimeMs: facts.responseTimeMs,
    redirectChain: facts.redirectChain,
    hasCanonical: parsed.canonical !== null,
    canonicalUrl: parsed.canonical,
    hasRobotsTxt: extra.hasRobotsTxt,
    hasSitemap: extra.hasSitemap,
    hasViewport: parsed.viewport !== null,
    languageDeclared: parsed.lang,
    hasFavicon: hasFavicon(parsed, extra),
    hasOpenGraph: Object.keys(parsed.ogTags).length > 0,
    hasSchemaOrg: parsed.jsonLdTypes.length > 0 || parsed.microdataTypes.length > 0,
    schemaTypes: [...new Set([...parsed.jsonLdTypes, ...parsed.microdataTypes])],
    imageCount: parsed.images.total,
    imagesWithAlt: parsed.images.withAlt,
    brokenLinksChecked: extra.brokenLinksChecked,
    brokenLinksFound: extra.brokenLinksFound,
    mobileFriendlyHeuristic: parsed.viewport !== null && !parsed.hasFixedWidthLayout,
  };
}

export function buildSeoSummary(parsed: ParsedPage): WebsiteSeoSummary {
  const title = parsed.title;
  const description = parsed.metaDescription;
  const h1Count = parsed.h1s.length;
  const h2Count = parsed.h2s.length;
  const robots = (parsed.metaRobots ?? "").toLowerCase();
  return {
    title,
    titleLength: title === null ? 0 : title.trim().length,
    titleQuality: classifyTitle(title),
    metaDescription: description,
    metaDescriptionLength: description === null ? 0 : description.trim().length,
    descriptionQuality: classifyDescription(description),
    h1Count,
    h2Count,
    headingStructureOk: h1Count === 1 && (h2Count > 0 || parsed.headingCount <= 2),
    indexable: robots.includes("noindex") ? false : true,
    wordCount: parsed.wordCount,
  };
}

export function buildUxSummary(parsed: ParsedPage): WebsiteUxSummary {
  const hasPhone = parsed.phoneMatches.length > 0;
  const hasEmail = parsed.emailMatches.length > 0;
  const hasAddress = parsed.addressHints.length > 0;
  return {
    hasVisibleCta: parsed.ctaCandidates.length > 0,
    ctaSamples: parsed.ctaCandidates.slice(0, 5),
    hasContactInfo: hasPhone || hasEmail || hasAddress || parsed.links.whatsapp.length > 0,
    hasPhone,
    phoneSamples: parsed.phoneMatches.slice(0, 3),
    hasEmail,
    hasAddress,
    hasOpeningHours: parsed.openingHoursHints.length > 0,
    hasBooking: parsed.booking.found,
    hasReservation: parsed.booking.found,
    hasMenu: parsed.menu.found,
    hasWhatsApp: parsed.links.whatsapp.length > 0,
    socialLinks: parsed.links.social.map((link) => ({ platform: link.platform, url: link.url })),
  };
}

export function buildBrandingSummary(parsed: ParsedPage, extra: ExtraChecks): WebsiteBrandingSummary {
  const logo = parsed.logo.found ? 30 : 0;
  const favicon = hasFavicon(parsed, extra) ? 15 : 0;
  const openGraph = Object.keys(parsed.ogTags).length > 0 ? 15 : 0;
  const name = parsed.nameConsistency ? 25 : 0;
  const coherence = titleH1Coherence(parsed.title, parsed.h1s) ? 15 : 0;
  return {
    hasLogoSignal: parsed.logo.found,
    logoUrl: parsed.logo.url,
    nameConsistency: parsed.nameConsistency,
    consistencyScore: logo + favicon + openGraph + name + coherence,
  };
}

export interface QualityBreakdown {
  score: number;
  components: Record<string, number>;
}

/** Weighted quality score. The component weights sum to 100. */
export function computeQualityScore(parsed: ParsedPage, seo: WebsiteSeoSummary, ux: WebsiteUxSummary, technical: WebsiteTechnicalSummary): QualityBreakdown {
  const altCoverage = parsed.images.total === 0 ? 1 : parsed.images.withAlt / parsed.images.total;
  const components: Record<string, number> = {
    https: technical.https === true ? 10 : 0,
    title: seo.titleQuality === "good" ? 8 : seo.titleQuality === "weak" ? 4 : 0,
    description: seo.descriptionQuality === "good" ? 7 : seo.descriptionQuality === "weak" ? 3.5 : 0,
    h1: seo.h1Count === 1 ? 6 : seo.h1Count > 1 ? 3 : 0,
    viewport: technical.hasViewport === true ? 10 : 0,
    canonical: technical.hasCanonical === true ? 4 : 0,
    schema: technical.hasSchemaOrg === true ? 6 : 0,
    openGraph: technical.hasOpenGraph === true ? 4 : 0,
    favicon: technical.hasFavicon === true ? 3 : 0,
    imageAlt: Math.round(altCoverage * 5 * 100) / 100,
    cta: ux.hasVisibleCta ? 10 : 0,
    contact: ux.hasContactInfo ? 8 : 0,
    mobile: technical.mobileFriendlyHeuristic === true ? 10 : 0,
    responseTime: technical.responseTimeMs !== null && technical.responseTimeMs < FAST_RESPONSE_MS ? 5 : 0,
    content: seo.wordCount >= MIN_CONTENT_WORDS ? 4 : 0,
  };
  const raw = Object.values(components).reduce((sum, value) => sum + value, 0);
  return { score: Math.max(0, Math.min(100, Math.round(raw))), components };
}
