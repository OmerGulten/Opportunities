import type { GenerateMessageInput, GeneratedMessage } from "@/types/ai";

import { CHANNEL_LIMITS, EMAIL_WORD_RANGES, EMAIL_WORD_TOLERANCE, MAX_BODY_CHARS, countWords } from "./limits";

/**
 * Post-generation fact guard. It cannot prove a message is truthful, but it
 * catches the typical ways a draft drifts from the facts: numbers and links
 * that appear nowhere in the input, manipulative phrasing, channel length
 * violations and a missing signature. The caller decides whether to retry,
 * warn or block.
 */
export type FactGuardViolationType = "unknown_number" | "unknown_url" | "forbidden_phrase" | "too_long" | "missing_signature";

export interface FactGuardViolation {
  type: FactGuardViolationType;
  /** Offending fragment or a short machine-readable reason; not user-facing copy. */
  detail: string;
}

export interface FactGuardReport {
  ok: boolean;
  violations: FactGuardViolation[];
}

// Patterns ------------------------------------------------------------------------

const URL_RE =
  /(?:https?:\/\/|www\.)[^\s<>"'()\[\]]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|info|biz|io|co|app|dev|me|site|online|shop|store|xyz|ai|uk|de|eu|tr)(?:\.tr)?(?:\/[^\s<>"'()\[\]]*)?/gi;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const PERCENT_RE = /\d+(?:[.,]\d+)?\s?%|%\s?\d+(?:[.,]\d+)?/g;
/** Digit groups joined by spaces, dots, dashes or parentheses; qualifies as phone-like with >= 9 digits. */
const PHONE_CANDIDATE_RE = /\+?\(?\d[\d\s().-]{7,}\d/g;
const NUMBER_RE = /\d+(?:[.,]\d+)*/g;

/** Manipulative or unverifiable claims in Turkish and English (matched against lower-cased text). */
const FORBIDDEN_PATTERNS: RegExp[] = [
  // Turkish
  /müşteri(?:ler)?(?:iniz)?i?\s+kaybed/u,
  /kaybettiğiniz/u,
  /kaybediyorsunuz/u,
  /satış(?:larınız)?ı?\s+kaybed/u,
  /rakipleriniz(?:in)?\s+müşteriler/u,
  /rakipleriniz\s+(?:sizi\s+)?geçiyor/u,
  /ziyaretçiler(?:in|inizin)?\s*%/u,
  /%\s*\d+(?:[.,]\d+)?\s*(?:si|sı|i|ı|u|ü)\s+(?:ziyaretçi|müşteri|kullanıcı)/u,
  /araştırmalar(?:a göre)?\s+gösteriyor/u,
  /garanti\s+ed/u,
  /son\s+şans/u,
  /hemen\s+harekete\s+geç/u,
  // English
  /losing\s+(?:customers|clients|sales|business|revenue)/u,
  /you\s+are\s+losing/u,
  /you're\s+losing/u,
  /lose\s+(?:customers|clients|sales|business|revenue)/u,
  /lost\s+(?:customers|clients|sales|revenue)/u,
  /%\s*of\s+(?:your\s+)?(?:visitors|customers|users|consumers|people)/u,
  /(?:visitors|customers|users)\s+(?:will\s+)?leave/u,
  /competitors?\s+(?:are\s+|is\s+)?(?:taking|stealing|winning)/u,
  /studies\s+show/u,
  /research\s+shows/u,
  /guarantee/u,
  /last\s+chance/u,
  /act\s+now/u,
];

// Helpers -------------------------------------------------------------------------

function lowerBoth(text: string): string[] {
  return [text.toLocaleLowerCase("tr"), text.toLowerCase()];
}

function normalizeUrl(raw: string): { full: string; host: string } {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.replace(/[.,;:!?)\]]+$/, "").replace(/\/+$/, "");
  const host = s.split(/[/?#]/)[0] ?? s;
  return { full: s, host };
}

function collectUrls(text: string): string[] {
  return text.match(URL_RE) ?? [];
}

function collectEmails(text: string): string[] {
  return text.match(EMAIL_RE) ?? [];
}

function stripUrlsAndEmails(text: string): string {
  return text.replace(EMAIL_RE, " ").replace(URL_RE, " ");
}

/** Numeric interpretations of a token such as "1.250", "4,6" or "1.250,50". */
function numberCandidates(token: string): number[] {
  const out = new Set<number>();
  const digitsOnly = Number(token.replace(/[.,]/g, ""));
  if (Number.isFinite(digitsOnly)) out.add(digitsOnly);
  const separators = token.match(/[.,]/g) ?? [];
  if (separators.length === 1) {
    const dec = Number(token.replace(",", "."));
    if (Number.isFinite(dec)) out.add(dec);
  } else if (separators.length > 1) {
    const lastIndex = Math.max(token.lastIndexOf("."), token.lastIndexOf(","));
    const dec = Number(`${token.slice(0, lastIndex).replace(/[.,]/g, "")}.${token.slice(lastIndex + 1)}`);
    if (Number.isFinite(dec)) out.add(dec);
  }
  return [...out];
}

function phoneLikeSequences(text: string): string[] {
  const matches = text.match(PHONE_CANDIDATE_RE) ?? [];
  return matches.filter((m) => (m.match(/\d/g) ?? []).length >= 9);
}

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

/** Texts whose numbers and links are, by construction, acceptable for the model to reuse. */
function allowedSourceTexts(input: GenerateMessageInput): string[] {
  const { business, sender, offering } = input;
  return [
    input.templateBody,
    input.templateSubject,
    input.userInstruction,
    sender.companyDescription,
    offering?.description,
    offering?.deliveryTime,
    offering?.promptContext,
    ...business.googleGaps,
    ...business.topFindings.flatMap((f) => [f.title, f.explanation]),
  ].filter((t): t is string => typeof t === "string" && t.length > 0);
}

// Checks --------------------------------------------------------------------------

function checkNumbers(text: string, input: GenerateMessageInput, violations: FactGuardViolation[]) {
  const { business, offering } = input;
  const sources = allowedSourceTexts(input);
  const allowedValues = new Set<number>();
  const allowedTokens = new Set<string>();

  const addValue = (v: number | null | undefined) => {
    if (typeof v === "number" && Number.isFinite(v)) allowedValues.add(v);
  };
  addValue(business.rating);
  addValue(business.reviewCount);
  if (business.rating !== null) addValue(5); // rating scale
  for (const s of business.serviceScores) addValue(s.score);
  if (business.serviceScores.length) addValue(100); // score scale
  addValue(offering?.priceFrom);
  addValue(offering?.priceTo);
  for (let year = 2020; year <= 2030; year++) addValue(year);
  for (let n = 1; n <= 12; n++) addValue(n);
  for (const source of sources) {
    for (const token of source.match(NUMBER_RE) ?? []) {
      allowedTokens.add(token);
      for (const candidate of numberCandidates(token)) allowedValues.add(candidate);
    }
    for (const pct of source.match(PERCENT_RE) ?? []) allowedTokens.add(pct.replace(/\s/g, ""));
    for (const phone of phoneLikeSequences(source)) allowedTokens.add(phone.replace(/\D/g, ""));
  }

  let remaining = stripUrlsAndEmails(text);

  // Phone-like sequences are contact details; they are never derivable from the facts.
  for (const phone of phoneLikeSequences(remaining)) {
    if (!allowedTokens.has(phone.replace(/\D/g, ""))) violations.push({ type: "unknown_number", detail: phone.trim() });
    remaining = remaining.replace(phone, " ");
  }

  // Percentages are statistics unless they were literally in an allowed text.
  for (const pct of remaining.match(PERCENT_RE) ?? []) {
    if (!allowedTokens.has(pct.replace(/\s/g, ""))) violations.push({ type: "unknown_number", detail: pct.trim() });
    remaining = remaining.replace(pct, " ");
  }

  const seen = new Set<string>();
  for (const token of remaining.match(NUMBER_RE) ?? []) {
    if (seen.has(token)) continue;
    seen.add(token);
    if (allowedTokens.has(token)) continue;
    const ok = numberCandidates(token).some((c) => [...allowedValues].some((a) => approxEqual(a, c)));
    if (!ok) violations.push({ type: "unknown_number", detail: token });
  }
}

function checkUrls(text: string, input: GenerateMessageInput, violations: FactGuardViolation[]) {
  const allowedFull = new Set<string>();
  const allowedHosts = new Set<string>();
  const addUrl = (raw: string | null | undefined) => {
    if (!raw) return;
    const { full, host } = normalizeUrl(raw);
    if (full) allowedFull.add(full);
    if (host) allowedHosts.add(host);
  };
  addUrl(input.business.websiteUrl);
  addUrl(input.reportLink);
  const sources = allowedSourceTexts(input);
  for (const source of sources) for (const url of collectUrls(source)) addUrl(url);
  const allowedEmails = new Set(sources.flatMap((s) => collectEmails(s).map((e) => e.toLowerCase())));

  const reportNormalized = input.reportLink ? normalizeUrl(input.reportLink).full : null;
  const linksPolicy = CHANNEL_LIMITS[input.channel].links;

  for (const email of collectEmails(text)) {
    if (!allowedEmails.has(email.toLowerCase())) violations.push({ type: "unknown_url", detail: email });
  }
  const seen = new Set<string>();
  for (const raw of collectUrls(text.replace(EMAIL_RE, " "))) {
    const { full, host } = normalizeUrl(raw);
    if (!full || seen.has(full)) continue;
    seen.add(full);
    const known = allowedFull.has(full) || allowedHosts.has(host);
    if (!known) {
      violations.push({ type: "unknown_url", detail: raw });
      continue;
    }
    if (linksPolicy === "report_only" && full !== reportNormalized) {
      violations.push({ type: "unknown_url", detail: `link_not_allowed_on_channel:${raw}` });
    }
  }
}

function checkForbiddenPhrases(text: string, violations: FactGuardViolation[]) {
  const variants = lowerBoth(text);
  const seen = new Set<string>();
  for (const pattern of FORBIDDEN_PATTERNS) {
    for (const variant of variants) {
      const match = pattern.exec(variant);
      if (match && !seen.has(match[0])) {
        seen.add(match[0]);
        violations.push({ type: "forbidden_phrase", detail: match[0] });
        break;
      }
    }
  }
}

function checkLength(message: GeneratedMessage, input: GenerateMessageInput, violations: FactGuardViolation[]) {
  const limit = CHANNEL_LIMITS[input.channel];
  const bodyChars = message.body.length;
  if (bodyChars > MAX_BODY_CHARS || (input.channel !== "email" && bodyChars > limit.maxBodyChars)) {
    violations.push({ type: "too_long", detail: `body:${bodyChars}>${Math.min(limit.maxBodyChars, MAX_BODY_CHARS)}` });
  }
  if (input.channel === "email") {
    const words = countWords(message.body);
    const max = Math.round(EMAIL_WORD_RANGES[input.length].max * EMAIL_WORD_TOLERANCE);
    if (words > max) violations.push({ type: "too_long", detail: `body_words:${words}>${max}` });
    if (message.subject && message.subject.length > limit.maxSubjectChars) {
      violations.push({ type: "too_long", detail: `subject:${message.subject.length}>${limit.maxSubjectChars}` });
    }
  }
}

function checkSignature(message: GeneratedMessage, input: GenerateMessageInput, violations: FactGuardViolation[]) {
  const haystacks = lowerBoth(message.body);
  const needles: string[] = [];
  const name = input.sender.senderName?.trim();
  if (name) {
    needles.push(name);
    const first = name.split(/\s+/)[0];
    if (first && first.length >= 3) needles.push(first);
  }
  const workspace = input.sender.workspaceName.trim();
  if (workspace) needles.push(workspace);
  if (!needles.length) return;
  const found = needles.some((needle) => lowerBoth(needle).some((n) => haystacks.some((h) => h.includes(n))));
  if (!found) violations.push({ type: "missing_signature", detail: name || workspace });
}

/**
 * Verifies a generated message against the facts it was generated from.
 * Allowed numbers: rating, review count, service scores (and the 5 / 100
 * scales), offering prices, years 2020-2030, 1-12, and any number that appears
 * in the template, user instruction, findings, gaps or offering texts.
 * Allowed links: websiteUrl, reportLink and links present in those same texts.
 */
export function verifyMessageAgainstFacts(message: GeneratedMessage, input: GenerateMessageInput): FactGuardReport {
  const violations: FactGuardViolation[] = [];
  const text = [message.subject ?? "", message.body].filter(Boolean).join("\n");

  checkNumbers(text, input, violations);
  checkUrls(text, input, violations);
  checkForbiddenPhrases(text, violations);
  checkLength(message, input, violations);
  checkSignature(message, input, violations);

  return { ok: violations.length === 0, violations };
}
