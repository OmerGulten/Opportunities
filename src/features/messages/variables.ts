import { observationStatusLabel, websiteStatusLabel } from "@/lib/providers/ai/status-labels";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import type { OfferingFacts, SenderFacts, VerifiedBusinessFacts } from "@/types/ai";
import type { Locale } from "@/types/common";

/**
 * Template variables for outreach templates. Syntax: {{variable_name}}
 * (spaces inside the braces are tolerated). Variables resolve from verified
 * facts only; anything unknown or null is removed cleanly and never renders
 * as "undefined" or "null".
 */
export interface MessageVariableDefinition {
  key: string;
  /** i18n key in the `messages` namespace, e.g. "variables.business_name". */
  descriptionKey: string;
  example: string;
}

export const MESSAGE_VARIABLES: readonly MessageVariableDefinition[] = [
  { key: "business_name", descriptionKey: "variables.business_name", example: "Kadıköy Kahve Evi" },
  { key: "district", descriptionKey: "variables.district", example: "Kadıköy" },
  { key: "city", descriptionKey: "variables.city", example: "İstanbul" },
  { key: "rating", descriptionKey: "variables.rating", example: "4,6" },
  { key: "review_count", descriptionKey: "variables.review_count", example: "1.250" },
  { key: "website_status", descriptionKey: "variables.website_status", example: "Web sitesi bulunamadı" },
  { key: "instagram_status", descriptionKey: "variables.instagram_status", example: "Kontrol edilmedi" },
  { key: "primary_service", descriptionKey: "variables.primary_service", example: "Web Sitesi Geliştirme" },
  { key: "opportunity_score", descriptionKey: "variables.opportunity_score", example: "85" },
  { key: "top_finding", descriptionKey: "variables.top_finding", example: "Google İşletme profilinde web sitesi bağlantısı bulunmuyor" },
  { key: "report_link", descriptionKey: "variables.report_link", example: "https://app.example.com/report/abc123" },
  { key: "sender_name", descriptionKey: "variables.sender_name", example: "Ayşe Yılmaz" },
  { key: "sender_title", descriptionKey: "variables.sender_title", example: "Kurucu" },
  { key: "workspace_name", descriptionKey: "variables.workspace_name", example: "Marmara Dijital" },
  { key: "category", descriptionKey: "variables.category", example: "Kafe" },
  { key: "google_maps_url", descriptionKey: "variables.google_maps_url", example: "https://maps.google.com/?cid=123" },
  { key: "offering_name", descriptionKey: "variables.offering_name", example: "Başlangıç Web Sitesi" },
  { key: "offering_price_range", descriptionKey: "variables.offering_price_range", example: "₺7.500–₺12.000" },
];

export const MESSAGE_VARIABLE_KEYS: readonly string[] = MESSAGE_VARIABLES.map((v) => v.key);

const VARIABLE_RE = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

export interface VariableContextArgs {
  facts: VerifiedBusinessFacts;
  sender: SenderFacts;
  offering?: OfferingFacts | null;
  /** Label of the primary service; derived from facts.serviceScores when omitted. */
  primaryService?: string | null;
  /** Primary opportunity score; derived from facts.serviceScores when omitted. */
  opportunityScore?: number | null;
  reportLink?: string | null;
  mapsUrl?: string | null;
  locale: Locale;
}

export function formatOfferingPriceRange(offering: OfferingFacts | null | undefined, locale: Locale): string | null {
  if (!offering) return null;
  const from = offering.priceFrom !== null ? formatCurrency(offering.priceFrom, locale, offering.currency) : null;
  const to = offering.priceTo !== null ? formatCurrency(offering.priceTo, locale, offering.currency) : null;
  if (from && to) return from === to ? from : `${from}–${to}`;
  if (from) return `${from}+`;
  if (to) return `≤ ${to}`;
  return null;
}

function blank(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function buildVariableContext(args: VariableContextArgs): Record<string, string | null> {
  const { facts, sender, offering, locale } = args;
  const topService = [...facts.serviceScores].sort((a, b) => b.score - a.score)[0];
  const primaryService = args.primaryService !== undefined ? blank(args.primaryService) : (topService?.serviceLabel ?? null);
  const score = args.opportunityScore !== undefined ? args.opportunityScore : (topService?.score ?? null);

  return {
    business_name: blank(facts.businessName),
    district: blank(facts.district),
    city: blank(facts.city),
    category: blank(facts.categoryLabel),
    rating: facts.rating !== null ? formatNumber(facts.rating, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null,
    review_count: facts.reviewCount !== null ? formatNumber(facts.reviewCount, locale) : null,
    website_status: blank(facts.websiteStatus) ? websiteStatusLabel(facts.websiteStatus, locale) : null,
    instagram_status: blank(facts.instagramStatus) ? observationStatusLabel(facts.instagramStatus, locale) : null,
    primary_service: primaryService,
    opportunity_score: score !== null && score !== undefined && Number.isFinite(score) ? String(Math.round(score)) : null,
    top_finding: blank(facts.topFindings[0]?.title),
    report_link: blank(args.reportLink),
    sender_name: blank(sender.senderName),
    sender_title: blank(sender.senderTitle),
    workspace_name: blank(sender.workspaceName),
    google_maps_url: blank(args.mapsUrl),
    offering_name: blank(offering?.name),
    offering_price_range: formatOfferingPriceRange(offering, locale),
  };
}

/** Unique variable names in order of first appearance. */
export function extractVariables(template: string): string[] {
  const out: string[] = [];
  for (const match of template.matchAll(VARIABLE_RE)) {
    const name = match[1];
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

export function validateTemplateBody(template: string): { ok: boolean; unknownVariables: string[] } {
  const unknownVariables = extractVariables(template).filter((name) => !MESSAGE_VARIABLE_KEYS.includes(name));
  return { ok: unknownVariables.length === 0, unknownVariables };
}

export interface ResolveTemplateOptions {
  /**
   * What to do with variables that are not keys of the context at all.
   * "remove" (default) drops them like null values; "keep" leaves the
   * placeholder in place (useful for partial resolution / previews).
   * Variables present in the context with a null/undefined value are always removed.
   */
  unknown?: "remove" | "keep";
}

export interface ResolvedTemplate {
  text: string;
  /** Variables that were null, undefined or unknown (unique, in order). */
  missing: string[];
  /** Variables that resolved to a value (unique, in order). */
  used: string[];
}

// Private-use sentinel; never appears in user text.
const MARK = "";
const CONNECTORS = "[,;·|/–-]";

function cleanupLine(line: string): string {
  let s = line;
  // Empty brackets / quotes left behind: "(MARK)" -> ""
  s = s.replace(new RegExp(`[(\\[«"']\\s*${MARK}\\s*[)\\]»"']`, "g"), MARK);
  // Line-leading connector after a removed value: "MARK, İstanbul" -> "İstanbul"
  s = s.replace(new RegExp(`^(\\s*)${MARK}\\s*${CONNECTORS}\\s*`, "g"), "$1");
  // Trailing colon introducing a removed value: "raporu: MARK" -> "raporu."
  s = s.replace(new RegExp(`\\s*:\\s*${MARK}\\s*$`), ".");
  // Connector before a removed value that is followed by punctuation or line end: "Kadıköy, MARK." -> "Kadıköy."
  s = s.replace(new RegExp(`\\s*${CONNECTORS}\\s*${MARK}(?=\\s*(?:[,.;:!?)]|${CONNECTORS}|$))`, "g"), "");
  // Anything else: just drop the marker.
  s = s.replace(new RegExp(MARK, "g"), "");
  // Whitespace and orphan punctuation cleanup.
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.replace(/ +([,.;:!?])/g, "$1");
  s = s.replace(/\( +/g, "(").replace(/ +\)/g, ")");
  s = s.replace(/([,;:])\s*\1+/g, "$1");
  s = s.replace(/^[ \t]*[,;:]\s*/, "");
  return s.trimEnd();
}

export function resolveTemplate(
  template: string,
  context: Record<string, string | number | null | undefined>,
  opts: ResolveTemplateOptions = {},
): ResolvedTemplate {
  const unknownMode = opts.unknown ?? "remove";
  const missing: string[] = [];
  const used: string[] = [];

  const lines = template.split(/\r?\n/);
  const resolvedLines: string[] = [];

  for (const line of lines) {
    const originallyBlank = line.trim().length === 0;
    const replaced = line.replace(VARIABLE_RE, (placeholder, name: string) => {
      const known = Object.prototype.hasOwnProperty.call(context, name);
      const value = known ? context[name] : undefined;
      if (value === null || value === undefined || (typeof value === "string" && value.trim().length === 0)) {
        if (!known && unknownMode === "keep") {
          if (!missing.includes(name)) missing.push(name);
          return placeholder;
        }
        if (!missing.includes(name)) missing.push(name);
        return MARK;
      }
      if (!used.includes(name)) used.push(name);
      return typeof value === "number" ? String(value) : value;
    });
    const cleaned = cleanupLine(replaced);
    // A line that only held removed variables disappears; intentional blank lines stay.
    if (!originallyBlank && cleaned.trim().length === 0) continue;
    resolvedLines.push(cleaned);
  }

  const text = resolvedLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, missing, used };
}
