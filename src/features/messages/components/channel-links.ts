import type { MessageChannel } from "@/types/common";

/**
 * Builds the deep link that opens a conversation in the user's own client.
 *
 * The app never sends anything: these links only pre-fill a compose window that
 * the user then reviews and sends. A channel with no usable contact returns
 * `null` so the UI can say plainly that no contact was found, instead of
 * offering a button that silently does nothing.
 */

export interface BusinessContactLinks {
  /** Digits in international form when we have one, otherwise whatever was observed. */
  phone: string | null;
  email: string | null;
  /** Profile URL or handle as observed. */
  instagram: string | null;
}

/** Keeps digits only; a leading "00" international prefix becomes nothing. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Fewer than 8 digits cannot be dialled internationally; treat it as unusable.
  return digits.length >= 8 ? digits : null;
}

export function buildWhatsAppUrl(phone: string | null | undefined, text: string): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function buildMailtoUrl(email: string | null | undefined, subject: string | null, body: string): string | null {
  const address = email?.trim();
  if (!address || !address.includes("@")) return null;
  const params = new URLSearchParams();
  if (subject && subject.trim().length > 0) params.set("subject", subject.trim());
  params.set("body", body);
  // URLSearchParams encodes spaces as "+", which mail clients render literally.
  return `mailto:${encodeURIComponent(address)}?${params.toString().replace(/\+/g, "%20")}`;
}

/** Accepts a profile URL, an @handle or a bare handle. */
export function buildInstagramUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^(www\.)?instagram\.com\//i.test(raw)) return `https://${raw.replace(/^www\./i, "")}`;
  const handle = raw.replace(/^@/, "").replace(/\/+$/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
  return `https://www.instagram.com/${handle}/`;
}

export interface ChannelLinkInput {
  channel: MessageChannel;
  contacts: BusinessContactLinks;
  subject: string | null;
  body: string;
}

/** The link for the selected channel, or null when no contact was observed. */
export function buildChannelLink({ channel, contacts, subject, body }: ChannelLinkInput): string | null {
  switch (channel) {
    case "whatsapp":
      return buildWhatsAppUrl(contacts.phone, body);
    case "email":
      return buildMailtoUrl(contacts.email, subject, body);
    case "instagram_dm":
      // Instagram has no documented pre-filled DM link; we open the profile and
      // the user pastes the text they just copied.
      return buildInstagramUrl(contacts.instagram);
    default:
      return null;
  }
}

/** i18n key (in the `messages` namespace) explaining why a channel has no link. */
export function missingContactKey(channel: MessageChannel): string {
  switch (channel) {
    case "whatsapp":
      return "actions.missingPhone";
    case "email":
      return "actions.missingEmail";
    default:
      return "actions.missingInstagram";
  }
}
