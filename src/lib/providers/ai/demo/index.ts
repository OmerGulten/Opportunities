import { formatCurrency, formatNumber, truncate } from "@/lib/utils/format";
import type {
  AIProvider,
  AIResult,
  AnalyzeOpportunityInput,
  GenerateMessageInput,
  GeneratedMessage,
  OpportunityAnalysis,
} from "@/types/ai";
import type { Locale, MessageChannel, MessageLength } from "@/types/common";

import { CHANNEL_LIMITS, EMAIL_WORD_RANGES, countWords, targetBodyChars } from "../limits";
import { PROMPT_VERSION } from "../prompts";
import { isUnknownStatus, observationStatusLabel, websiteStatusLabel } from "../status-labels";
import { DEMO_PHRASES, type DemoPhrases } from "./phrases";

/**
 * Deterministic demo AI provider. Composes a fact-bound message from the
 * verified facts without any model call so the whole UI runs without
 * credentials. Same input => same output.
 */
export interface DemoAIProviderOptions {
  model: string;
  /** Simulated latency, default 150ms. Use 0 in tests. */
  latencyMs?: number;
}

const MAX_SUMMARY_CHARS = 700;

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function areaOf(input: { district: string | null; city: string | null }): string | null {
  return input.district ?? input.city ?? null;
}

export function formatRating(rating: number, locale: Locale): string {
  return formatNumber(rating, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatPriceRange(
  offering: { priceFrom: number | null; priceTo: number | null; currency: string },
  locale: Locale,
): string | null {
  const from = offering.priceFrom !== null ? formatCurrency(offering.priceFrom, locale, offering.currency) : null;
  const to = offering.priceTo !== null ? formatCurrency(offering.priceTo, locale, offering.currency) : null;
  if (from && to) return from === to ? from : `${from}–${to}`;
  if (from) return `${from}+`;
  if (to) return `≤ ${to}`;
  return null;
}

interface Part {
  text: string;
  /** Parts with a higher drop order are removed first when the channel limit is exceeded. */
  dropOrder: number | null;
  group: "greeting" | "observation" | "pitch" | "report" | "cta" | "signature";
}

interface Composed {
  subject: string | null;
  body: string;
  usedFacts: string[];
}

function signatureLines(input: GenerateMessageInput): string[] {
  const { senderName, senderTitle, workspaceName } = input.sender;
  if (!senderName) return [workspaceName];
  const second = [senderTitle, workspaceName].filter((v): v is string => Boolean(v)).join(", ");
  return second ? [senderName, second] : [senderName];
}

function chatSignature(input: GenerateMessageInput): string {
  const { senderName, workspaceName } = input.sender;
  return senderName ? `— ${senderName}, ${workspaceName}` : `— ${workspaceName}`;
}

function includeFor(length: MessageLength, minimum: MessageLength): boolean {
  const order: Record<MessageLength, number> = { short: 0, medium: 1, long: 2 };
  return order[length] >= order[minimum];
}

function composeParts(input: GenerateMessageInput, phrases: DemoPhrases): { parts: Part[]; usedFacts: string[] } {
  const { business, sender, offering, locale, tone, channel, length } = input;
  const usedFacts: string[] = ["business.name", "service.label"];
  const parts: Part[] = [];
  const area = areaOf(business);
  if (area) usedFacts.push(business.district ? "business.district" : "business.city");

  parts.push({ text: phrases.greeting(tone, business.businessName), dropOrder: null, group: "greeting" });

  if (channel === "email" && includeFor(length, "medium")) {
    parts.push({ text: phrases.intro(sender.senderName, sender.workspaceName), dropOrder: 6, group: "observation" });
    usedFacts.push("sender.workspaceName");
  }

  // One specific observation, grounded in the strongest available fact.
  const finding = business.topFindings[0];
  if (finding) {
    parts.push({ text: phrases.observationFinding(finding.title, area), dropOrder: null, group: "observation" });
    usedFacts.push("business.topFindings[0]");
  } else if (business.googleGaps[0]) {
    parts.push({ text: phrases.observationGap(business.googleGaps[0], area), dropOrder: null, group: "observation" });
    usedFacts.push("business.googleGaps[0]");
  } else if (business.websiteStatus && business.websiteStatus !== "not_checked") {
    parts.push({ text: phrases.observationWebsite(websiteStatusLabel(business.websiteStatus, locale)), dropOrder: null, group: "observation" });
    usedFacts.push("business.websiteStatus");
  } else {
    parts.push({ text: phrases.observationGeneric(area), dropOrder: null, group: "observation" });
  }

  if (business.rating !== null && business.reviewCount !== null && includeFor(length, "medium")) {
    parts.push({
      text: phrases.rating(formatRating(business.rating, locale), formatNumber(business.reviewCount, locale)),
      dropOrder: 4,
      group: "observation",
    });
    usedFacts.push("business.rating", "business.reviewCount");
  }

  if (includeFor(length, "medium")) parts.push({ text: phrases.impact(), dropOrder: 5, group: "pitch" });

  parts.push({ text: phrases.opportunity(input.serviceLabel), dropOrder: null, group: "pitch" });

  if (offering) {
    const price = formatPriceRange(offering, locale);
    const delivery = includeFor(length, "long") ? offering.deliveryTime : null;
    parts.push({ text: phrases.offering(offering.name, price, delivery), dropOrder: 3, group: "pitch" });
    usedFacts.push("offering.name");
    if (price) usedFacts.push("offering.priceFrom", "offering.priceTo");
    if (delivery) usedFacts.push("offering.deliveryTime");
    if (offering.description && includeFor(length, "long")) {
      parts.push({ text: phrases.offeringDescription(offering.description), dropOrder: 2, group: "pitch" });
      usedFacts.push("offering.description");
    }
  }

  const secondary = business.topFindings[1];
  if (secondary && includeFor(length, "long")) {
    parts.push({ text: phrases.secondaryFinding(secondary.title), dropOrder: 1, group: "pitch" });
    usedFacts.push("business.topFindings[1]");
  }

  if (sender.companyDescription && channel === "email" && includeFor(length, "long")) {
    parts.push({ text: phrases.about(sender.workspaceName, sender.companyDescription), dropOrder: 0, group: "pitch" });
    usedFacts.push("sender.companyDescription");
  }

  if (input.reportLink) {
    parts.push({ text: phrases.report(input.reportLink), dropOrder: null, group: "report" });
    usedFacts.push("reportLink");
  }

  parts.push({ text: phrases.cta(tone, channel), dropOrder: null, group: "cta" });

  if (channel === "email") {
    parts.push({ text: [phrases.signOff(tone), ...signatureLines(input)].join("\n"), dropOrder: null, group: "signature" });
  } else {
    parts.push({ text: chatSignature(input), dropOrder: null, group: "signature" });
  }
  usedFacts.push(sender.senderName ? "sender.name" : "sender.workspaceName");

  return { parts, usedFacts: [...new Set(usedFacts)] };
}

function joinParts(parts: Part[], channel: MessageChannel): string {
  if (channel === "instagram_dm") {
    // One flowing paragraph, signature on its own line.
    const main = parts.filter((p) => p.group !== "signature").map((p) => p.text).join(" ");
    const signature = parts.find((p) => p.group === "signature")?.text ?? "";
    return `${main}\n${signature}`.trim();
  }
  const groups: string[] = [];
  let current: Part["group"] | null = null;
  let buffer: string[] = [];
  for (const part of parts) {
    if (current !== null && part.group !== current) {
      groups.push(buffer.join(" "));
      buffer = [];
    }
    current = part.group;
    buffer.push(part.text);
  }
  if (buffer.length) groups.push(buffer.join(" "));
  return groups.join(channel === "email" ? "\n\n" : "\n").trim();
}

/** Drop optional parts (highest dropOrder first) until the body fits, then hard-truncate as a last resort. */
function fitToChannel(parts: Part[], input: GenerateMessageInput): string {
  const { channel, length } = input;
  const limit = CHANNEL_LIMITS[channel].maxBodyChars;
  const target = channel === "email" ? limit : Math.max(targetBodyChars(channel, length), Math.round(limit * 0.5));
  let working = [...parts];
  let body = joinParts(working, channel);

  const overEmailWords = () => channel === "email" && countWords(body) > EMAIL_WORD_RANGES[length].max;
  while ((body.length > target || overEmailWords()) && working.some((p) => p.dropOrder !== null)) {
    const maxOrder = Math.max(...working.map((p) => p.dropOrder ?? -1));
    working = working.filter((p) => p.dropOrder !== maxOrder);
    body = joinParts(working, channel);
  }
  if (body.length <= limit) return body;

  // Hard limit still exceeded (very long names/findings): shorten the observation sentence.
  const signature = working.find((p) => p.group === "signature")?.text ?? "";
  const reserve = signature.length + 2;
  const withoutSignature = working.filter((p) => p.group !== "signature");
  const mainText = joinParts(withoutSignature, channel);
  const shortened = truncate(mainText, Math.max(20, limit - reserve));
  return `${shortened}\n${signature}`.trim();
}

function composeFromTemplate(input: GenerateMessageInput, phrases: DemoPhrases): Composed {
  const limit = CHANNEL_LIMITS[input.channel];
  let body = (input.templateBody ?? "").trim();
  const usedFacts = ["template.body"];
  const lower = body.toLocaleLowerCase(input.locale === "tr" ? "tr" : "en");
  if (input.reportLink && !body.includes(input.reportLink)) {
    body = `${body}\n\n${phrases.report(input.reportLink)}`;
    usedFacts.push("reportLink");
  }
  const { senderName, workspaceName } = input.sender;
  const signed = (senderName && lower.includes(senderName.toLocaleLowerCase("tr"))) || lower.includes(workspaceName.toLocaleLowerCase("tr"));
  if (!signed) {
    body = input.channel === "email" ? `${body}\n\n${signatureLines(input).join("\n")}` : `${body}\n${chatSignature(input)}`;
    usedFacts.push(senderName ? "sender.name" : "sender.workspaceName");
  }
  if (body.length > limit.maxBodyChars) body = truncate(body, limit.maxBodyChars);
  const subject = limit.allowsSubject
    ? truncate(input.templateSubject ?? phrases.subject(input.business.businessName, input.serviceLabel), limit.maxSubjectChars)
    : null;
  if (input.templateSubject && subject) usedFacts.push("template.subject");
  return { subject, body, usedFacts };
}

export function composeDemoMessage(input: GenerateMessageInput): Composed {
  const phrases = DEMO_PHRASES[input.locale] ?? DEMO_PHRASES.tr;
  if (input.templateBody && input.templateBody.trim().length > 0) return composeFromTemplate(input, phrases);

  const { parts, usedFacts } = composeParts(input, phrases);
  const body = fitToChannel(parts, input);
  const limit = CHANNEL_LIMITS[input.channel];
  const subject = limit.allowsSubject ? truncate(phrases.subject(input.business.businessName, input.serviceLabel), limit.maxSubjectChars) : null;
  return { subject, body, usedFacts };
}

export function composeDemoAnalysis(input: AnalyzeOpportunityInput): OpportunityAnalysis {
  const phrases = (DEMO_PHRASES[input.locale] ?? DEMO_PHRASES.tr).analysis;
  const { business, services, locale } = input;

  const ranked = [...services].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const runnerUp = ranked[1];
  const standsOut = top !== undefined && top.score > 0 && (runnerUp === undefined || top.score > runnerUp.score);

  const summary = truncate(
    [
      phrases.summaryIntro(business.businessName, business.categoryLabel, areaOf(business), services.length),
      standsOut ? phrases.summaryTop(top.serviceLabel, Math.round(top.score)) : phrases.summaryNoScores(),
      phrases.summaryBasis(),
    ].join(" "),
    MAX_SUMMARY_CHARS,
  );

  const primaryRecommendation = standsOut
    ? {
        serviceKey: top.serviceKey,
        rationale: top.reasons.length ? phrases.rationaleFromReasons(top.reasons.slice(0, 3)) : phrases.rationaleScoreOnly(Math.round(top.score)),
      }
    : null;

  const talkingPoints: string[] = [];
  for (const finding of business.topFindings.slice(0, 3)) talkingPoints.push(finding.title.trim().replace(/[.!?]+$/, "") + ".");
  if (business.rating !== null && business.reviewCount !== null) {
    talkingPoints.push(phrases.pointRating(formatRating(business.rating, locale), formatNumber(business.reviewCount, locale)));
  }
  if (business.googleGaps[0]) talkingPoints.push(phrases.pointGap(business.googleGaps[0]));
  if (business.websiteStatus && business.websiteStatus !== "not_checked") {
    talkingPoints.push(phrases.pointWebsite(websiteStatusLabel(business.websiteStatus, locale)));
  }

  const cautions: string[] = [];
  if (isUnknownStatus(business.instagramStatus)) cautions.push(phrases.cautionInstagram(observationStatusLabel(business.instagramStatus, locale)));
  if (isUnknownStatus(business.websiteStatus)) cautions.push(phrases.cautionWebsite(websiteStatusLabel(business.websiteStatus, locale)));
  for (const finding of business.topFindings.filter((f) => f.confidence === "low")) cautions.push(phrases.cautionLowConfidence(finding.title));
  if (business.topFindings.length === 0) cautions.push(phrases.cautionNoFindings());

  return {
    summary,
    primaryRecommendation,
    talkingPoints: talkingPoints.slice(0, 5),
    cautions: cautions.slice(0, 5),
  };
}

export function createDemoAIProvider(options: DemoAIProviderOptions): AIProvider {
  const latencyMs = options.latencyMs ?? 150;
  const model = options.model;

  async function withMeta<T>(produce: () => T): Promise<AIResult<T>> {
    const started = Date.now();
    await sleep(latencyMs);
    const output = produce();
    return {
      output,
      meta: {
        provider: "demo",
        model,
        latencyMs: Date.now() - started,
        inputTokens: null,
        outputTokens: null,
        promptVersion: PROMPT_VERSION,
      },
    };
  }

  return {
    name: "demo",
    model,
    isDemo: true,
    generateMessage(input: GenerateMessageInput): Promise<AIResult<GeneratedMessage>> {
      return withMeta(() => {
        const composed = composeDemoMessage(input);
        return { ...composed, tone: input.tone, channel: input.channel };
      });
    },
    analyzeOpportunity(input: AnalyzeOpportunityInput): Promise<AIResult<OpportunityAnalysis>> {
      return withMeta(() => composeDemoAnalysis(input));
    },
  };
}
