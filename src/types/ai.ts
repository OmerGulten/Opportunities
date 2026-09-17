import type { ConfidenceLevel, Locale, MessageChannel, MessageLength, Tone } from "./common";

/**
 * Verified facts passed to the AI. Everything here comes from the database
 * (provider snapshot, audits, scores). The model must not invent anything else.
 * Website content never enters this structure as free text.
 */
export interface VerifiedBusinessFacts {
  businessName: string;
  categoryLabel: string | null;
  district: string | null;
  city: string | null;
  rating: number | null;
  reviewCount: number | null;
  websiteStatus: string; // WebsiteStatus label
  websiteUrl: string | null;
  instagramStatus: string; // ObservationStatus
  googleGaps: string[]; // localized short labels, e.g. "missing opening hours"
  topFindings: Array<{ key: string; title: string; explanation?: string; confidence: ConfidenceLevel }>;
  serviceScores: Array<{ serviceKey: string; serviceLabel: string; score: number }>;
}

export interface SenderFacts {
  senderName: string | null;
  senderTitle: string | null;
  workspaceName: string;
  companyDescription: string | null;
}

export interface OfferingFacts {
  name: string;
  description: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  currency: string;
  billingPeriod: string;
  deliveryTime: string | null;
  promptContext: string | null;
}

export interface GenerateMessageInput {
  locale: Locale;
  channel: MessageChannel;
  tone: Tone;
  length: MessageLength;
  serviceKey: string;
  serviceLabel: string;
  business: VerifiedBusinessFacts;
  sender: SenderFacts;
  offering: OfferingFacts | null;
  /** Optional template body already resolved with variables; the model adapts it. */
  templateBody: string | null;
  templateSubject: string | null;
  reportLink: string | null;
  /** Additional instruction from the user (treated as user content, not system). */
  userInstruction?: string | null;
}

export interface GeneratedMessage {
  subject: string | null;
  body: string;
  /** Facts the model claims to have used; validated against input by the service. */
  usedFacts: string[];
  tone: Tone;
  channel: MessageChannel;
}

export interface AnalyzeOpportunityInput {
  locale: Locale;
  business: VerifiedBusinessFacts;
  services: Array<{ serviceKey: string; serviceLabel: string; score: number; reasons: string[] }>;
}

export interface OpportunityAnalysis {
  summary: string; // 2-3 neutral sentences
  primaryRecommendation: { serviceKey: string; rationale: string } | null;
  talkingPoints: string[]; // max 5, each grounded in a provided fact
  cautions: string[]; // things that are unknown / not checked
}

export interface AIGenerationMeta {
  provider: string;
  model: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  promptVersion: string;
}

export interface AIResult<T> {
  output: T;
  meta: AIGenerationMeta;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  readonly isDemo: boolean;
  generateMessage(input: GenerateMessageInput): Promise<AIResult<GeneratedMessage>>;
  analyzeOpportunity(input: AnalyzeOpportunityInput): Promise<AIResult<OpportunityAnalysis>>;
}
