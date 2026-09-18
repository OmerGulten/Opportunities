import type { MessageChannel, MessageLength } from "@/types/common";

/**
 * Channel constraints shared by the prompt builder, the demo provider and the
 * fact guard so that all three agree on what "too long" means.
 */
export interface ChannelLimit {
  /** Hard upper bound for the body in characters (including the signature). */
  maxBodyChars: number;
  /** Whether the channel carries a subject line. */
  allowsSubject: boolean;
  /** Maximum subject length in characters (only meaningful when allowsSubject). */
  maxSubjectChars: number;
  /** "all": any link that is a verified fact; "report_only": only reportLink. */
  links: "all" | "report_only";
}

export const CHANNEL_LIMITS: Record<MessageChannel, ChannelLimit> = {
  whatsapp: { maxBodyChars: 700, allowsSubject: false, maxSubjectChars: 0, links: "all" },
  instagram_dm: { maxBodyChars: 500, allowsSubject: false, maxSubjectChars: 0, links: "report_only" },
  email: { maxBodyChars: 2500, allowsSubject: true, maxSubjectChars: 80, links: "all" },
};

/** E-mail body word ranges by requested length. */
export const EMAIL_WORD_RANGES: Record<MessageLength, { min: number; max: number }> = {
  short: { min: 90, max: 120 },
  medium: { min: 120, max: 170 },
  long: { min: 170, max: 220 },
};

/**
 * For character-limited channels the requested length scales the target size
 * below the hard limit (the hard limit still applies to every length).
 */
export const CHAT_LENGTH_RATIO: Record<MessageLength, number> = {
  short: 0.5,
  medium: 0.75,
  long: 1,
};

/** Tolerance applied by the fact guard before flagging an e-mail body as too long. */
export const EMAIL_WORD_TOLERANCE = 1.2;

/** Absolute schema bound for any body (mirrors generatedMessageSchema). */
export const MAX_BODY_CHARS = 2500;

export function targetBodyChars(channel: MessageChannel, length: MessageLength): number {
  return Math.round(CHANNEL_LIMITS[channel].maxBodyChars * CHAT_LENGTH_RATIO[length]);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
