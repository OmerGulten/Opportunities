import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

/**
 * Pure HTML extraction for the website audit. Everything here is an observation
 * about the markup that was actually fetched: no network access, no inference
 * about things the page does not contain. `audit.ts` turns these observations
 * into signals and findings.
 */

export type SocialPlatform = "instagram" | "facebook" | "x-twitter" | "tiktok" | "youtube" | "linkedin";

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export interface ParsedLinks {
  internal: string[];
  external: string[];
  tel: string[];
  mailto: string[];
  whatsapp: string[];
  social: SocialLink[];
}

export interface ParsedHint {
  found: boolean;
  hints: string[];
}

export interface ParsedPage {
  title: string | null;
  metaDescription: string | null;
  metaRobots: string | null;
  canonical: string | null;
  lang: string | null;
  viewport: string | null;
  ogTags: Record<string, string>;
  twitterCard: string | null;
  jsonLdTypes: string[];
  microdataTypes: string[];
  faviconLinks: string[];
  /** Resolved `/favicon.ico` candidate, set only when no favicon link element was declared. */
  implicitFavicon: string | null;
  h1s: string[];
  h2s: string[];
  headingCount: number;
  images: { total: number; withAlt: number; withoutDimensions: number };
  links: ParsedLinks;
  phoneMatches: string[];
  emailMatches: string[];
  addressHints: string[];
  openingHoursHints: string[];
  ctaCandidates: string[];
  booking: ParsedHint;
  menu: ParsedHint;
  wordCount: number;
  scripts: { total: number; inHeadBlocking: number; external: number };
  styles: { external: number; inlineBytes: number };
  htmlBytes: number;
  /** Heuristic: a desktop-only fixed pixel layout (>= 900px) was declared. */
  hasFixedWidthLayout: boolean;
  logo: { found: boolean; url: string | null };
  /** The business name is recognisable in the title, og:site_name, an h1 or the logo. */
  nameConsistency: boolean;
  forms: number;
  languageDeclared: boolean;
}

const MAX_SAMPLES = 8;
const FIXED_WIDTH_PX = 900;

const SOCIAL_HOSTS: Array<{ platform: SocialPlatform; test: (host: string) => boolean }> = [
  { platform: "instagram", test: (host) => host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am" },
  { platform: "facebook", test: (host) => host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com" || host === "fb.me" },
  { platform: "x-twitter", test: (host) => host === "twitter.com" || host.endsWith(".twitter.com") || host === "x.com" || host.endsWith(".x.com") },
  { platform: "tiktok", test: (host) => host === "tiktok.com" || host.endsWith(".tiktok.com") },
  { platform: "youtube", test: (host) => host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be" },
  { platform: "linkedin", test: (host) => host === "linkedin.com" || host.endsWith(".linkedin.com") },
];

const BOOKING_HOSTS = [
  "calendly.com",
  "setmore.com",
  "zenchef.com",
  "opentable.com",
  "opentable.com.tr",
  "resmio.com",
  "doktortakvimi.com",
  "treatwell.com",
  "treatwell.com.tr",
];

const BOOKING_WORDS = /\b(rezervasyon|randevu|book|booking|reserve|reservation|appointment)\b/;
const MENU_WORDS = /\b(menu|menuler|yemek listesi|carte|lezzetler)\b/;
const CTA_WORDS =
  /\b(rezervasyon|randevu|ara|bizi arayin|iletisim|siparis|teklif|hemen|book|reserve|call|contact|order|get a quote|whatsapp)\b/;

const ADDRESS_WORDS =
  /\b(mah|mahalle|mahallesi|cad|cadde|caddesi|sok|sokak|bulvar|bulvari|blv|no|kat|daire|apt|street|avenue|suite|floor|road|district)\b/;
const HOURS_WORDS =
  /\b(acilis|calisma saatleri|calisma saati|acik|hafta ici|hafta sonu|pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar|opening hours|open hours|business hours|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|fri)\b/;
const TIME_RANGE = /\d{1,2}[:.]\d{2}\s*[-–—]\s*\d{1,2}[:.]\d{2}/;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Turkish mobile/landline and generic international forms. Deliberately narrow:
// a stray year or price must not be reported as a phone number.
const PHONE_RES: RegExp[] = [
  /(?:\+90|0090)[ .-]?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{2}[ .-]?\d{2}/g,
  /\b0\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{2}[ .-]?\d{2}\b/g,
  /\b\d{3}[ .-]\d{3}[ .-]\d{2}[ .-]\d{2}\b/g,
  /\+\d{1,3}[ .-]?\(?\d{2,4}\)?[ .-]?\d{3}[ .-]?\d{2,4}[ .-]?\d{0,4}/g,
];

const STOP_TOKENS = new Set([
  "ltd",
  "sti",
  "as",
  "inc",
  "llc",
  "gmbh",
  "co",
  "com",
  "the",
  "and",
  "ve",
  "sirketi",
  "anonim",
  "limited",
]);

/** Lowercase, fold Turkish characters and diacritics, keep alphanumerics. */
export function foldText(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function nameTokens(name: string): string[] {
  return foldText(name)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_TOKENS.has(token));
}

function pushUnique(target: string[], value: string, limit = MAX_SAMPLES): void {
  const trimmed = value.trim();
  if (trimmed === "" || target.length >= limit || target.includes(trimmed)) return;
  target.push(trimmed);
}

function absolute(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function classifySocial(url: string): SocialPlatform | null {
  const host = safeHostname(url);
  if (host === null) return null;
  for (const entry of SOCIAL_HOSTS) {
    if (entry.test(host)) return entry.platform;
  }
  return null;
}

function isWhatsAppLink(rawHref: string, resolved: string | null): boolean {
  const lower = rawHref.trim().toLowerCase();
  if (lower.startsWith("whatsapp:")) return true;
  const host = resolved === null ? null : safeHostname(resolved);
  return host === "wa.me" || host === "api.whatsapp.com" || host === "chat.whatsapp.com";
}

function collectJsonLdTypes(node: unknown, out: Set<string>, depth = 0): void {
  if (depth > 8 || node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdTypes(item, out, depth + 1);
    return;
  }
  const record = node as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type === "string") out.add(type);
  else if (Array.isArray(type)) {
    for (const entry of type) if (typeof entry === "string") out.add(entry);
  }
  const graph = record["@graph"];
  if (graph !== undefined) collectJsonLdTypes(graph, out, depth + 1);
  for (const [key, value] of Object.entries(record)) {
    if (key === "@type" || key === "@graph") continue;
    if (value !== null && typeof value === "object") collectJsonLdTypes(value, out, depth + 1);
  }
}

function maxPxWidth(text: string): number {
  let max = 0;
  const re = /(?:min-)?width\s*:\s*(\d{3,5})\s*px/g;
  let match = re.exec(text);
  while (match !== null) {
    max = Math.max(max, Number(match[1]));
    match = re.exec(text);
  }
  return max;
}

function detectFixedWidthLayout($: CheerioAPI, viewport: string | null): boolean {
  if (viewport !== null && /width\s*=\s*\d{3,5}/.test(viewport)) return true;

  let fixed = false;
  $("[width]")
    .not("img, svg, iframe, canvas, video, source, picture, embed, object, input, rect, image")
    .each((_, element) => {
      if (fixed) return;
      const raw = $(element).attr("width") ?? "";
      const numeric = Number(raw.replace(/px$/i, "").trim());
      if (Number.isFinite(numeric) && numeric >= FIXED_WIDTH_PX) fixed = true;
    });
  if (fixed) return true;

  $("[style]")
    .not("img, svg, iframe, canvas, video, source, picture, embed, object")
    .each((_, element) => {
      if (fixed) return;
      if (maxPxWidth(($(element).attr("style") ?? "").toLowerCase()) >= FIXED_WIDTH_PX) fixed = true;
    });
  if (fixed) return true;

  $("style").each((_, element) => {
    if (fixed) return;
    if (maxPxWidth($(element).text().toLowerCase()) >= FIXED_WIDTH_PX) fixed = true;
  });
  return fixed;
}

function detectLogo($: CheerioAPI, baseUrl: string, ogImage: string | undefined): { found: boolean; url: string | null } {
  const candidates = [
    'img[class*="logo" i]',
    'img[id*="logo" i]',
    'img[src*="logo" i]',
    'img[alt*="logo" i]',
    '[class*="logo" i] img',
    'header img[alt]',
    'a[class*="brand" i] img',
  ];
  for (const selector of candidates) {
    const element = $(selector).first();
    if (element.length > 0) {
      const src = element.attr("src") ?? element.attr("data-src") ?? "";
      const resolved = src === "" ? null : absolute(src, baseUrl);
      return { found: true, url: resolved };
    }
  }
  if ($('svg[class*="logo" i]').length > 0 || $('[class*="logo" i]').length > 0) {
    return { found: true, url: null };
  }
  if (ogImage !== undefined && ogImage !== "") {
    return { found: true, url: absolute(ogImage, baseUrl) };
  }
  return { found: false, url: null };
}

/**
 * Visible text. Parsed into its own document so removing script/style nodes does
 * not disturb the counts taken from the main one.
 */
function textOf(html: string): string {
  const doc = cheerio.load(html);
  doc("script, style, noscript, template, svg").remove();
  return doc("body").text().replace(/\s+/g, " ").trim();
}

/**
 * Parses a fetched HTML document.
 *
 * @param html      raw response body
 * @param baseUrl   final URL of the response (relative links resolve against it)
 * @param businessName name used for the brand-consistency observation
 */
export function parseHtml(html: string, baseUrl: string, businessName: string): ParsedPage {
  const $ = cheerio.load(html);

  const title = $("head title").first().text().trim() || $("title").first().text().trim() || null;
  const metaDescription = ($('meta[name="description" i]').attr("content") ?? "").trim() || null;
  const metaRobots = ($('meta[name="robots" i]').attr("content") ?? "").trim() || null;
  const canonicalRaw = ($('link[rel="canonical" i]').attr("href") ?? "").trim();
  const canonical = canonicalRaw === "" ? null : (absolute(canonicalRaw, baseUrl) ?? canonicalRaw);
  const langRaw = ($("html").attr("lang") ?? "").trim();
  const lang = langRaw === "" ? null : langRaw;
  const viewport = ($('meta[name="viewport" i]').attr("content") ?? "").trim() || null;

  const ogTags: Record<string, string> = {};
  $('meta[property^="og:" i], meta[name^="og:" i]').each((_, element) => {
    const key = ($(element).attr("property") ?? $(element).attr("name") ?? "").toLowerCase();
    const content = ($(element).attr("content") ?? "").trim();
    if (key !== "" && content !== "" && ogTags[key] === undefined) ogTags[key] = content;
  });
  const twitterCard = ($('meta[name="twitter:card" i]').attr("content") ?? "").trim() || null;

  const jsonLdSet = new Set<string>();
  $('script[type="application/ld+json" i]').each((_, element) => {
    const raw = $(element).text().trim();
    if (raw === "") return;
    try {
      collectJsonLdTypes(JSON.parse(raw), jsonLdSet);
    } catch {
      // Malformed JSON-LD is common; it simply yields no types.
    }
  });

  const microdataSet = new Set<string>();
  $("[itemtype]").each((_, element) => {
    const value = ($(element).attr("itemtype") ?? "").trim();
    if (value === "") return;
    const segment = value.split(/[/#]/).filter(Boolean).pop();
    if (segment !== undefined && segment !== "") microdataSet.add(segment);
  });

  const faviconLinks: string[] = [];
  $('link[rel*="icon" i]').each((_, element) => {
    const href = ($(element).attr("href") ?? "").trim();
    if (href === "") return;
    const resolved = absolute(href, baseUrl);
    if (resolved !== null) pushUnique(faviconLinks, resolved, 5);
  });

  const h1s: string[] = [];
  $("h1").each((_, element) => pushUnique(h1s, $(element).text()));
  const h2s: string[] = [];
  $("h2").each((_, element) => pushUnique(h2s, $(element).text()));
  const headingCount = $("h1, h2, h3, h4, h5, h6").length;

  let imagesTotal = 0;
  let imagesWithAlt = 0;
  let imagesWithoutDimensions = 0;
  $("img").each((_, element) => {
    imagesTotal += 1;
    const alt = $(element).attr("alt");
    if (alt !== undefined && alt.trim() !== "") imagesWithAlt += 1;
    const width = $(element).attr("width");
    const height = $(element).attr("height");
    const style = ($(element).attr("style") ?? "").toLowerCase();
    const styled = style.includes("width") && style.includes("height");
    if (!styled && (width === undefined || width.trim() === "" || height === undefined || height.trim() === "")) imagesWithoutDimensions += 1;
  });

  const links: ParsedLinks = { internal: [], external: [], tel: [], mailto: [], whatsapp: [], social: [] };
  const socialSeen = new Set<string>();
  const ctaCandidates: string[] = [];
  const bookingHints: string[] = [];
  const menuHints: string[] = [];
  const baseHost = safeHostname(baseUrl);

  const considerCta = (label: string): void => {
    const folded = foldText(label);
    if (folded === "" || folded.length > 60) return;
    if (CTA_WORDS.test(folded)) pushUnique(ctaCandidates, label.replace(/\s+/g, " ").trim());
  };

  $("a[href]").each((_, element) => {
    const rawHref = ($(element).attr("href") ?? "").trim();
    if (rawHref === "" || rawHref.startsWith("#")) {
      considerCta($(element).text());
      return;
    }
    const label = $(element).text().replace(/\s+/g, " ").trim();
    const foldedLabel = foldText(label);
    const lowerHref = rawHref.toLowerCase();
    considerCta(label);
    considerCta($(element).attr("title") ?? "");
    considerCta($(element).attr("aria-label") ?? "");

    if (lowerHref.startsWith("tel:")) {
      pushUnique(links.tel, rawHref.slice(4).trim());
      return;
    }
    if (lowerHref.startsWith("mailto:")) {
      pushUnique(links.mailto, rawHref.slice(7).split("?")[0].trim());
      return;
    }

    const resolved = absolute(rawHref, baseUrl);
    if (isWhatsAppLink(rawHref, resolved)) {
      pushUnique(links.whatsapp, resolved ?? rawHref);
      return;
    }
    if (resolved === null) return;

    const platform = classifySocial(resolved);
    if (platform !== null) {
      if (!socialSeen.has(resolved)) {
        socialSeen.add(resolved);
        if (links.social.length < 12) links.social.push({ platform, url: resolved });
      }
      return;
    }

    const host = safeHostname(resolved);
    const foldedHref = foldText(decodeURIComponent(lowerHref));
    if (BOOKING_WORDS.test(foldedHref) || BOOKING_WORDS.test(foldedLabel)) pushUnique(bookingHints, label || resolved, 5);
    if (host !== null && BOOKING_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))) {
      pushUnique(bookingHints, resolved, 5);
    }
    if (MENU_WORDS.test(foldedHref) || MENU_WORDS.test(foldedLabel)) pushUnique(menuHints, label || resolved, 5);

    if (host !== null && baseHost !== null && (host === baseHost || host.endsWith(`.${baseHost}`) || baseHost.endsWith(`.${host}`))) {
      pushUnique(links.internal, resolved, 40);
    } else {
      pushUnique(links.external, resolved, 20);
    }
  });

  $("button, input[type='submit'], input[type='button'], [role='button']").each((_, element) => {
    const label = $(element).text().replace(/\s+/g, " ").trim() || ($(element).attr("value") ?? "");
    considerCta(label);
  });

  const text = textOf(html);
  const foldedText = foldText(text);

  const emailMatches: string[] = [];
  for (const match of text.match(EMAIL_RE) ?? []) pushUnique(emailMatches, match.toLowerCase(), 5);
  for (const mail of links.mailto) pushUnique(emailMatches, mail.toLowerCase(), 5);

  const phoneMatches: string[] = [];
  for (const phone of links.tel) pushUnique(phoneMatches, phone, 5);
  for (const regex of PHONE_RES) {
    for (const match of text.match(regex) ?? []) {
      const digits = match.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 15) pushUnique(phoneMatches, match.trim(), 5);
    }
  }

  const addressHints: string[] = [];
  $("address, [itemprop='address'], [class*='address' i]").each((_, element) => {
    const value = $(element).text().replace(/\s+/g, " ").trim();
    if (value.length >= 8) pushUnique(addressHints, value.slice(0, 200), 3);
  });
  if (addressHints.length === 0) {
    for (const sentence of text.split(/[.!?•|\n]/)) {
      const folded = foldText(sentence);
      if (folded.length < 10 || folded.length > 160) continue;
      if (ADDRESS_WORDS.test(folded) && /\d/.test(folded)) pushUnique(addressHints, sentence.trim().slice(0, 200), 3);
      if (addressHints.length >= 3) break;
    }
  }
  if (jsonLdSet.has("PostalAddress")) pushUnique(addressHints, "schema.org/PostalAddress", 4);

  const openingHoursHints: string[] = [];
  $("[itemprop='openingHours'], [class*='hours' i], [class*='saat' i]").each((_, element) => {
    const value = $(element).text().replace(/\s+/g, " ").trim();
    if (value.length >= 4) pushUnique(openingHoursHints, value.slice(0, 160), 3);
  });
  if (openingHoursHints.length === 0) {
    for (const sentence of text.split(/[.!?•|\n]/)) {
      const folded = foldText(sentence);
      if (folded.length < 4 || folded.length > 160) continue;
      if (HOURS_WORDS.test(folded) && TIME_RANGE.test(sentence)) pushUnique(openingHoursHints, sentence.trim().slice(0, 160), 3);
      if (openingHoursHints.length >= 3) break;
    }
  }
  if (jsonLdSet.has("OpeningHoursSpecification")) pushUnique(openingHoursHints, "schema.org/OpeningHoursSpecification", 4);

  if (BOOKING_WORDS.test(foldedText) && bookingHints.length === 0) {
    // Text-only evidence is weaker than a link, but still an observation.
    const match = foldedText.match(BOOKING_WORDS);
    if (match !== null) pushUnique(bookingHints, match[0], 5);
  }
  if (MENU_WORDS.test(foldedText) && menuHints.length === 0) {
    const match = foldedText.match(MENU_WORDS);
    if (match !== null) pushUnique(menuHints, match[0], 5);
  }

  const wordCount = text === "" ? 0 : text.split(/\s+/).filter(Boolean).length;

  let scriptsTotal = 0;
  let scriptsExternal = 0;
  let scriptsInHeadBlocking = 0;
  $("script").each((_, element) => {
    const type = ($(element).attr("type") ?? "").toLowerCase();
    if (type.includes("ld+json")) return;
    scriptsTotal += 1;
    if (($(element).attr("src") ?? "") !== "") scriptsExternal += 1;
  });
  $("head script").each((_, element) => {
    const type = ($(element).attr("type") ?? "").toLowerCase();
    if (type.includes("ld+json")) return;
    const isAsync = $(element).attr("async") !== undefined;
    const isDefer = $(element).attr("defer") !== undefined;
    if (!isAsync && !isDefer) scriptsInHeadBlocking += 1;
  });

  const stylesExternal = $('link[rel="stylesheet" i]').length;
  let inlineStyleBytes = 0;
  $("style").each((_, element) => {
    inlineStyleBytes += byteLength($(element).text());
  });
  $("[style]").each((_, element) => {
    inlineStyleBytes += byteLength($(element).attr("style") ?? "");
  });

  const logo = detectLogo($, baseUrl, ogTags["og:image"]);

  const tokens = nameTokens(businessName);
  const haystack = foldText([title ?? "", ogTags["og:site_name"] ?? "", h1s.join(" "), $("img[alt]").first().attr("alt") ?? "", logo.url ?? ""].join(" "));
  const matched = tokens.filter((token) => haystack.includes(token)).length;
  const nameConsistency = tokens.length > 0 && matched / tokens.length >= 0.6;

  return {
    title,
    metaDescription,
    metaRobots,
    canonical,
    lang,
    viewport,
    ogTags,
    twitterCard,
    jsonLdTypes: [...jsonLdSet],
    microdataTypes: [...microdataSet],
    faviconLinks,
    implicitFavicon: faviconLinks.length === 0 ? absolute("/favicon.ico", baseUrl) : null,
    h1s,
    h2s,
    headingCount,
    images: { total: imagesTotal, withAlt: imagesWithAlt, withoutDimensions: imagesWithoutDimensions },
    links,
    phoneMatches,
    emailMatches,
    addressHints,
    openingHoursHints,
    ctaCandidates,
    booking: { found: bookingHints.length > 0, hints: bookingHints },
    menu: { found: menuHints.length > 0, hints: menuHints },
    wordCount,
    scripts: { total: scriptsTotal, inHeadBlocking: scriptsInHeadBlocking, external: scriptsExternal },
    styles: { external: stylesExternal, inlineBytes: inlineStyleBytes },
    htmlBytes: byteLength(html),
    hasFixedWidthLayout: detectFixedWidthLayout($, viewport),
    logo,
    nameConsistency,
    forms: $("form").length,
    languageDeclared: lang !== null && lang !== "",
  };
}
