import type { ConfidenceLevel, EvidenceType } from "@/types/common";
import { SIGNAL_TYPES, makeSignal, makeUnavailableSignal, type Signal, type SignalSource, type SignalValue } from "@/types/signals";

/**
 * Realistic signal sets for scoring tests. No real businesses: the names only
 * describe the scenario. Every observed signal shares one `detectedAt` so
 * duplicate handling can be tested deterministically on top of them.
 */
export const FIXTURE_DETECTED_AT = "2026-09-18T09:00:00.000Z";

function observed(
  signalType: string,
  value: SignalValue,
  source: SignalSource,
  confidence: ConfidenceLevel,
  explanation: string,
  evidenceType: EvidenceType = "observed",
): Signal {
  return makeSignal(signalType, value, { source, confidence, evidenceType, explanation, detectedAt: FIXTURE_DETECTED_AT });
}

function derived(signalType: string, value: SignalValue, explanation: string, confidence: ConfidenceLevel = "medium"): Signal {
  return observed(signalType, value, "derived", confidence, explanation, "derived");
}

function heuristic(signalType: string, value: SignalValue, source: SignalSource, explanation: string, confidence: ConfidenceLevel = "low"): Signal {
  return observed(signalType, value, source, confidence, explanation, "heuristic");
}

/**
 * (a) A well-reviewed Kadıköy restaurant with no website link on its Google
 * profile, opening hours missing, two photos, Instagram not checked and owner
 * replies unavailable. Typical output of a `basic` audit.
 */
export const kadikoyRestaurantNoWebsiteSignals: Signal[] = [
  observed(SIGNAL_TYPES.WEBSITE_STATUS, "not_found", "provider", "high", "No website URL was found on the business profile."),
  derived(SIGNAL_TYPES.WEBSITE_HAS_CTA, false, "No website was found, so no call to action could be observed."),
  derived(SIGNAL_TYPES.WEBSITE_HAS_BOOKING, false, "No website was found, so no booking flow could be observed."),
  derived(SIGNAL_TYPES.WEBSITE_HAS_CONTACT_INFO, false, "No website was found, so no contact information could be observed on a website."),
  makeUnavailableSignal(SIGNAL_TYPES.INSTAGRAM_STATUS, { source: "instagram_audit", status: "not_checked", explanation: "Instagram discovery was not run for this scan." }),
  observed(SIGNAL_TYPES.GOOGLE_BUSINESS_STATUS, "OPERATIONAL", "google_audit", "high", "The profile reports the business as operational."),
  observed(SIGNAL_TYPES.GOOGLE_RATING, 4.6, "google_audit", "high", "Average rating shown on the profile."),
  observed(SIGNAL_TYPES.GOOGLE_REVIEW_COUNT, 200, "google_audit", "high", "Number of reviews shown on the profile."),
  observed(SIGNAL_TYPES.GOOGLE_HAS_OPENING_HOURS, false, "google_audit", "high", "Opening hours are not shown on the profile."),
  observed(SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, 2, "google_audit", "medium", "Two photos were returned for the profile."),
  observed(SIGNAL_TYPES.GOOGLE_HAS_WEBSITE, false, "google_audit", "high", "No website link is shown on the profile."),
  observed(SIGNAL_TYPES.GOOGLE_HAS_PHONE, true, "google_audit", "high", "A phone number is shown on the profile."),
  derived(SIGNAL_TYPES.GOOGLE_COMPLETENESS_SCORE, 45, "Completeness derived from website, hours, phone and photo fields."),
  makeUnavailableSignal(SIGNAL_TYPES.GOOGLE_REVIEW_RESPONSE_RATE, { source: "google_audit", status: "unavailable", explanation: "Owner replies are not exposed for the sampled reviews." }),
];

/**
 * (b) A café with a strong, fast, complete website, an active Instagram
 * profile and a well-maintained Google profile. Output of a `deep` audit.
 */
export const strongWebsiteCafeSignals: Signal[] = [
  observed(SIGNAL_TYPES.WEBSITE_STATUS, "found", "website_audit", "high", "The website responded successfully."),
  observed(SIGNAL_TYPES.WEBSITE_URL, "https://example-cafe.test/", "website_audit", "high", "Final URL after redirects."),
  derived(SIGNAL_TYPES.WEBSITE_QUALITY, "strong", "Quality bucket derived from the technical and content checks."),
  derived(SIGNAL_TYPES.WEBSITE_QUALITY_SCORE, 88, "Quality score derived from the technical and content checks."),
  observed(SIGNAL_TYPES.WEBSITE_HTTPS, true, "website_audit", "high", "The final URL uses HTTPS."),
  observed(SIGNAL_TYPES.WEBSITE_RESPONSE_TIME_MS, 420, "website_audit", "medium", "Time to first byte of the home page."),
  observed(SIGNAL_TYPES.WEBSITE_STATUS_CODE, 200, "website_audit", "high", "HTTP status of the home page."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_META_TITLE, true, "website_audit", "high", "A title tag is present."),
  observed(SIGNAL_TYPES.WEBSITE_TITLE_QUALITY, "good", "website_audit", "medium", "The title has a descriptive length."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_META_DESCRIPTION, true, "website_audit", "high", "A meta description is present."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_H1, true, "website_audit", "high", "An H1 heading is present."),
  observed(SIGNAL_TYPES.WEBSITE_HEADING_STRUCTURE_OK, true, "website_audit", "medium", "Heading levels are nested in order."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_VIEWPORT, true, "website_audit", "high", "A viewport meta tag is present."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_CANONICAL, true, "website_audit", "high", "A canonical link is present."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_SCHEMA, true, "website_audit", "high", "schema.org JSON-LD was detected."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_OPEN_GRAPH, true, "website_audit", "high", "Open Graph tags are present."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_FAVICON, true, "website_audit", "high", "A favicon link is present."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_SITEMAP, true, "website_audit", "medium", "sitemap.xml responded successfully."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_ROBOTS, true, "website_audit", "medium", "robots.txt responded successfully."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_CTA, true, "website_audit", "medium", "A booking call to action was detected."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_CONTACT_INFO, true, "website_audit", "medium", "Phone and address were detected on the page."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_BOOKING, true, "website_audit", "medium", "A reservation link was detected."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_SOCIAL_LINKS, true, "website_audit", "high", "Links to social profiles were detected."),
  heuristic(SIGNAL_TYPES.WEBSITE_MOBILE_FRIENDLY, true, "website_audit", "Viewport and responsive hints indicate mobile friendliness.", "medium"),
  observed(SIGNAL_TYPES.WEBSITE_LANGUAGE_DECLARED, true, "website_audit", "high", "The html element declares a language."),
  observed(SIGNAL_TYPES.PERFORMANCE_MOBILE_SCORE, 82, "performance", "high", "PageSpeed Insights mobile performance score."),
  observed(SIGNAL_TYPES.PERFORMANCE_MOBILE_GRADE, "good", "performance", "high", "PageSpeed Insights mobile grade."),
  observed(SIGNAL_TYPES.INSTAGRAM_STATUS, "found", "instagram_audit", "high", "An Instagram profile linked from the website was found."),
  observed(SIGNAL_TYPES.INSTAGRAM_PROFILE_URL, "https://www.instagram.com/example_cafe/", "instagram_audit", "high", "Profile URL linked from the website."),
  observed(SIGNAL_TYPES.INSTAGRAM_IS_ACTIVE, true, "instagram_audit", "medium", "A recent post was visible."),
  observed(SIGNAL_TYPES.INSTAGRAM_HAS_WEBSITE_LINK, true, "instagram_audit", "medium", "The profile links to the website."),
  observed(SIGNAL_TYPES.INSTAGRAM_BIO_COMPLETE, true, "instagram_audit", "medium", "The bio contains a description and contact details."),
  observed(SIGNAL_TYPES.GOOGLE_BUSINESS_STATUS, "OPERATIONAL", "google_audit", "high", "The profile reports the business as operational."),
  observed(SIGNAL_TYPES.GOOGLE_RATING, 4.7, "google_audit", "high", "Average rating shown on the profile."),
  observed(SIGNAL_TYPES.GOOGLE_REVIEW_COUNT, 320, "google_audit", "high", "Number of reviews shown on the profile."),
  observed(SIGNAL_TYPES.GOOGLE_HAS_OPENING_HOURS, true, "google_audit", "high", "Opening hours are shown on the profile."),
  observed(SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, 40, "google_audit", "medium", "Forty photos were returned for the profile."),
  observed(SIGNAL_TYPES.GOOGLE_HAS_WEBSITE, true, "google_audit", "high", "A website link is shown on the profile."),
  observed(SIGNAL_TYPES.GOOGLE_HAS_PHONE, true, "google_audit", "high", "A phone number is shown on the profile."),
  derived(SIGNAL_TYPES.GOOGLE_COMPLETENESS_SCORE, 95, "Completeness derived from website, hours, phone and photo fields."),
  derived(SIGNAL_TYPES.GOOGLE_REVIEW_RESPONSE_RATE, 0.8, "Share of sampled reviews with an owner reply (sample of 5).", "low"),
  derived(SIGNAL_TYPES.GOOGLE_RECENT_UNANSWERED_REVIEWS, 0, "Sampled recent reviews without an owner reply (sample of 5).", "low"),
  observed(SIGNAL_TYPES.GOOGLE_REVIEW_SAMPLE_SIZE, 5, "google_audit", "high", "Number of reviews in the provider sample."),
  heuristic(SIGNAL_TYPES.BRANDING_HAS_LOGO_SIGNAL, true, "website_audit", "A logo image or share image was detected.", "medium"),
  heuristic(SIGNAL_TYPES.BRANDING_NAME_CONSISTENCY, true, "website_audit", "The website title contains the business name.", "medium"),
  heuristic(SIGNAL_TYPES.BRANDING_CONSISTENCY_SCORE, 80, "website_audit", "Heuristic brand consistency score."),
];

/**
 * (c) A business whose website exists but is weak: thin SEO markup, no
 * sitemap/robots, heuristic mobile issues and a low heuristic mobile score.
 * Instagram exists but has no website link; the Google profile is in good shape.
 * Output of a `deep` audit.
 */
export const weakWebsiteSeoGapsSignals: Signal[] = [
  observed(SIGNAL_TYPES.WEBSITE_STATUS, "found", "website_audit", "high", "The website responded successfully."),
  observed(SIGNAL_TYPES.WEBSITE_URL, "https://example-weak.test/", "website_audit", "high", "Final URL after redirects."),
  derived(SIGNAL_TYPES.WEBSITE_QUALITY, "weak", "Quality bucket derived from the technical and content checks."),
  derived(SIGNAL_TYPES.WEBSITE_QUALITY_SCORE, 31, "Quality score derived from the technical and content checks."),
  observed(SIGNAL_TYPES.WEBSITE_HTTPS, true, "website_audit", "high", "The final URL uses HTTPS."),
  observed(SIGNAL_TYPES.WEBSITE_STATUS_CODE, 200, "website_audit", "high", "HTTP status of the home page."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_META_TITLE, true, "website_audit", "high", "A title tag is present."),
  observed(SIGNAL_TYPES.WEBSITE_TITLE_QUALITY, "weak", "website_audit", "medium", "The title is a single generic word."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_META_DESCRIPTION, false, "website_audit", "high", "No meta description was found."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_H1, false, "website_audit", "high", "No H1 heading was found."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_VIEWPORT, false, "website_audit", "high", "No viewport meta tag was found."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_CANONICAL, false, "website_audit", "high", "No canonical link was found."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_SCHEMA, false, "website_audit", "high", "No schema.org structured data was detected."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_OPEN_GRAPH, false, "website_audit", "high", "No Open Graph tags were found."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_FAVICON, true, "website_audit", "high", "A favicon link is present."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_SITEMAP, false, "website_audit", "medium", "sitemap.xml returned 404."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_ROBOTS, false, "website_audit", "medium", "robots.txt returned 404."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_CTA, true, "website_audit", "medium", "A phone call to action was detected."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_CONTACT_INFO, true, "website_audit", "medium", "A phone number was detected on the page."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_BOOKING, false, "website_audit", "medium", "No booking or appointment flow was detected."),
  observed(SIGNAL_TYPES.WEBSITE_HAS_SOCIAL_LINKS, false, "website_audit", "high", "No links to social profiles were detected."),
  heuristic(SIGNAL_TYPES.WEBSITE_MOBILE_FRIENDLY, false, "website_audit", "No viewport tag and fixed-width layout hints indicate weak mobile friendliness."),
  observed(SIGNAL_TYPES.WEBSITE_LANGUAGE_DECLARED, false, "website_audit", "high", "The html element does not declare a language."),
  heuristic(SIGNAL_TYPES.PERFORMANCE_MOBILE_SCORE, 38, "performance", "Heuristic mobile score estimated from page weight and blocking resources; PageSpeed was unavailable."),
  heuristic(SIGNAL_TYPES.PERFORMANCE_MOBILE_GRADE, "poor", "performance", "Heuristic grade derived from the estimated mobile score."),
  observed(SIGNAL_TYPES.INSTAGRAM_STATUS, "found", "instagram_audit", "medium", "An Instagram profile matching the business name was found."),
  observed(SIGNAL_TYPES.INSTAGRAM_IS_ACTIVE, true, "instagram_audit", "medium", "A recent post was visible."),
  observed(SIGNAL_TYPES.INSTAGRAM_HAS_WEBSITE_LINK, false, "instagram_audit", "medium", "The profile does not link to a website."),
  observed(SIGNAL_TYPES.INSTAGRAM_BIO_COMPLETE, true, "instagram_audit", "medium", "The bio contains a description and contact details."),
  observed(SIGNAL_TYPES.GOOGLE_BUSINESS_STATUS, "OPERATIONAL", "google_audit", "high", "The profile reports the business as operational."),
  observed(SIGNAL_TYPES.GOOGLE_RATING, 4.4, "google_audit", "high", "Average rating shown on the profile."),
  observed(SIGNAL_TYPES.GOOGLE_REVIEW_COUNT, 35, "google_audit", "high", "Number of reviews shown on the profile."),
  observed(SIGNAL_TYPES.GOOGLE_HAS_OPENING_HOURS, true, "google_audit", "high", "Opening hours are shown on the profile."),
  observed(SIGNAL_TYPES.GOOGLE_PHOTO_COUNT, 12, "google_audit", "medium", "Twelve photos were returned for the profile."),
  observed(SIGNAL_TYPES.GOOGLE_HAS_WEBSITE, true, "google_audit", "high", "A website link is shown on the profile."),
  observed(SIGNAL_TYPES.GOOGLE_HAS_PHONE, true, "google_audit", "high", "A phone number is shown on the profile."),
  derived(SIGNAL_TYPES.GOOGLE_COMPLETENESS_SCORE, 80, "Completeness derived from website, hours, phone and photo fields."),
  derived(SIGNAL_TYPES.GOOGLE_REVIEW_RESPONSE_RATE, 0.6, "Share of sampled reviews with an owner reply (sample of 5).", "low"),
  derived(SIGNAL_TYPES.GOOGLE_RECENT_UNANSWERED_REVIEWS, 1, "Sampled recent reviews without an owner reply (sample of 5).", "low"),
  observed(SIGNAL_TYPES.GOOGLE_REVIEW_SAMPLE_SIZE, 5, "google_audit", "high", "Number of reviews in the provider sample."),
  heuristic(SIGNAL_TYPES.BRANDING_HAS_LOGO_SIGNAL, true, "website_audit", "A logo image was detected.", "medium"),
  heuristic(SIGNAL_TYPES.BRANDING_NAME_CONSISTENCY, true, "website_audit", "The website title contains the business name.", "medium"),
  heuristic(SIGNAL_TYPES.BRANDING_CONSISTENCY_SCORE, 55, "website_audit", "Heuristic brand consistency score."),
];

/**
 * (c) as a `basic` audit would emit it: identical except that the performance
 * provider did not run, so performance signals are explicitly `not_checked`.
 */
export const weakWebsiteSeoGapsBasicSignals: Signal[] = [
  ...weakWebsiteSeoGapsSignals.filter((signal) => !signal.signalType.startsWith("performance.")),
  makeUnavailableSignal(SIGNAL_TYPES.PERFORMANCE_MOBILE_SCORE, { source: "performance", status: "not_checked", explanation: "Performance checks run only in deep audits." }),
  makeUnavailableSignal(SIGNAL_TYPES.PERFORMANCE_MOBILE_GRADE, { source: "performance", status: "not_checked", explanation: "Performance checks run only in deep audits." }),
];
