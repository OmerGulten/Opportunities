import { createFindingCollector } from "@/lib/audits/finding";
import { createSignalFactory } from "@/lib/audits/signal";
import { foldText } from "@/lib/audits/website/parse";
import type { AuditOutcome, InstagramAuditSummary } from "@/types/audits";
import type { ConfidenceLevel, Locale, ObservationStatus } from "@/types/common";
import { SIGNAL_TYPES, type Signal } from "@/types/signals";

/**
 * Instagram discovery. The MVP never fetches instagram.com: it only decides
 * whether a profile reference exists in data we already have (the provider
 * payload or the audited website).
 *
 * Consequences, encoded literally below:
 *  - if the website was not audited and the provider exposes nothing, the status
 *    is `not_checked` — never `not_found`;
 *  - activity, bio, follower and website-link signals are always `unavailable`,
 *    because we do not look at the profile.
 */

const SOURCE = "instagram";
const RESERVED_SEGMENTS = new Set(["p", "explore", "reel", "reels", "stories", "tv", "s", "accounts", "direct", "about", "developer", "legal"]);

export interface InstagramDiscoveryInput {
  /** Social links found by the website audit. `null` means the website was not audited. */
  websiteSocialLinks: Array<{ platform: string; url: string }> | null;
  /** Social profiles exposed by the place provider. `null` means none were provided. */
  providerProfiles: Array<{ platform: string; url: string }> | null;
  businessName: string;
  locale: Locale;
}

/** Extracts the profile handle, ignoring post / reel / explore URLs. */
export function parseInstagramHandle(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const segments = parsed.pathname.split("/").filter((segment) => segment !== "");
  if (segments.length === 0) return null;
  const first = segments[0].toLowerCase();
  if (RESERVED_SEGMENTS.has(first)) return null;
  const handle = first.replace(/^@/, "");
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : null;
}

/** True when the handle is recognisably built from the business name. */
export function handleMatchesName(handle: string, businessName: string): boolean {
  const nameTokens = foldText(businessName)
    .split(" ")
    .filter((token) => token.length >= 3);
  if (nameTokens.length === 0) return false;
  const foldedHandle = foldText(handle.replace(/[._]/g, " "));
  const compactHandle = foldedHandle.replace(/\s+/g, "");
  const compactName = nameTokens.join("");
  if (compactHandle === "") return false;
  if (compactHandle.includes(compactName) || compactName.includes(compactHandle)) return true;
  const matched = nameTokens.filter((token) => compactHandle.includes(token)).length;
  return matched / nameTokens.length >= 0.5;
}

function instagramLinks(entries: ReadonlyArray<{ platform: string; url: string }> | null): string[] {
  if (entries === null) return [];
  const out: string[] = [];
  for (const entry of entries) {
    const platform = entry.platform.toLowerCase();
    const isInstagram = platform === "instagram" || /(^|\.)instagram\.com/i.test(entry.url) || /(^|\.)instagr\.am/i.test(entry.url);
    if (isInstagram && !out.includes(entry.url)) out.push(entry.url);
  }
  return out;
}

export function discoverInstagram(input: InstagramDiscoveryInput): AuditOutcome<InstagramAuditSummary> {
  const started = Date.now();
  const signals = createSignalFactory(input.locale, "instagram_audit");
  const collector = createFindingCollector(input.locale, SOURCE);
  const t = collector.t;
  const emitted: Signal[] = [];
  const notes: string[] = [];

  const providerLinks = instagramLinks(input.providerProfiles);
  const websiteLinks = instagramLinks(input.websiteSocialLinks);
  const websiteAudited = input.websiteSocialLinks !== null;

  let status: ObservationStatus;
  let confidence: ConfidenceLevel;
  let profileUrl: string | null = null;
  let handle: string | null = null;
  let discoveredVia: InstagramAuditSummary["discoveredVia"] = null;

  if (providerLinks.length > 0) {
    status = "found";
    confidence = "high";
    discoveredVia = "provider";
    profileUrl = providerLinks[0];
    handle = parseInstagramHandle(profileUrl);
    notes.push(t("note.instagram_from_provider"));
  } else if (websiteLinks.length > 0) {
    const handles = [...new Set(websiteLinks.map((url) => parseInstagramHandle(url)).filter((value): value is string => value !== null))];
    discoveredVia = "website";
    profileUrl = websiteLinks[0];
    if (handles.length > 1) {
      status = "ambiguous";
      confidence = "low";
      notes.push(t("note.instagram_multiple_candidates", { candidates: handles.join(", ") }));
    } else {
      status = "found";
      handle = handles[0] ?? null;
      const matches = handle !== null && handleMatchesName(handle, input.businessName);
      confidence = matches ? "high" : handle === null ? "low" : "medium";
      notes.push(matches ? t("note.instagram_handle_matches_name") : t("note.instagram_from_website"));
    }
  } else if (!websiteAudited) {
    status = "not_checked";
    confidence = "low";
    notes.push(t("note.instagram_website_not_audited"));
  } else if ((input.websiteSocialLinks ?? []).length > 0) {
    // Other social platforms were linked but Instagram was not: a real absence
    // on the website, still only as strong as the website itself.
    status = "not_found";
    confidence = "medium";
    notes.push(t("note.instagram_other_socials_only"));
  } else {
    status = "not_found";
    confidence = "low";
    notes.push(t("note.instagram_no_socials"));
  }

  notes.push(t("note.instagram_profile_not_fetched"));

  emitted.push(
    signals.emit(SIGNAL_TYPES.INSTAGRAM_STATUS, status, {
      status: status === "not_checked" ? "not_checked" : status,
      evidenceType: status === "not_checked" ? "unavailable" : "observed",
      confidence,
      source: discoveredVia === "provider" ? "provider" : "instagram_audit",
    }),
  );
  if (profileUrl !== null) {
    emitted.push(signals.emit(SIGNAL_TYPES.INSTAGRAM_PROFILE_URL, profileUrl, { confidence }));
  } else if (status === "not_found") {
    emitted.push(signals.emit(SIGNAL_TYPES.INSTAGRAM_PROFILE_URL, null, { status: "not_found", confidence }));
  } else {
    emitted.push(signals.unavailable(SIGNAL_TYPES.INSTAGRAM_PROFILE_URL, websiteAudited ? "instagram_not_checked" : "website_not_audited"));
  }

  // The MVP never opens the profile, so everything about its content is unknown.
  for (const type of [
    SIGNAL_TYPES.INSTAGRAM_DAYS_SINCE_LAST_POST,
    SIGNAL_TYPES.INSTAGRAM_IS_ACTIVE,
    SIGNAL_TYPES.INSTAGRAM_HAS_WEBSITE_LINK,
    SIGNAL_TYPES.INSTAGRAM_BIO_COMPLETE,
    SIGNAL_TYPES.INSTAGRAM_FOLLOWER_COUNT,
  ]) {
    emitted.push(signals.unavailable(type, "instagram_not_fetched", { status: "unavailable" }));
  }

  if (status === "not_found") {
    collector.add({
      key: "instagram_not_found",
      category: "social",
      severity: confidence === "medium" ? "medium" : "low",
      status: "not_found",
      confidence,
      evidence: { checkedSources: websiteAudited ? ["website"] : [], providerProfiles: providerLinks.length },
    });
  } else if (status === "ambiguous") {
    collector.add({
      key: "instagram_ambiguous",
      category: "social",
      severity: "low",
      status: "ambiguous",
      confidence: "low",
      evidence: { candidates: websiteLinks },
    });
  } else if (status === "not_checked") {
    collector.add({
      key: "instagram_not_checked",
      category: "social",
      severity: "info",
      status: "not_checked",
      evidenceType: "unavailable",
      confidence: "low",
      evidence: {},
    });
  }

  collector.add({
    key: "instagram_activity_unavailable",
    category: "social",
    severity: "info",
    status: "unavailable",
    evidenceType: "unavailable",
    confidence: "low",
    evidence: { profileUrl },
  });

  const summary: InstagramAuditSummary = {
    status,
    profileUrl,
    handle,
    discoveredVia,
    lastActivitySignal: null,
    daysSinceLastPost: null,
    isActive: null,
    hasWebsiteLink: null,
    bioComplete: null,
    followerCount: null,
    notes,
  };

  return {
    auditType: "instagram",
    status: "completed",
    observation: status,
    source: discoveredVia === "provider" ? "provider" : SOURCE,
    summary,
    findings: collector.findings,
    signals: emitted,
    durationMs: Date.now() - started,
  };
}
