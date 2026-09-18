import type { MessageChannel, MessageLength } from "@/types/common";

/**
 * Option lists the outreach UI iterates over. They mirror the enums in
 * `src/features/messages/schemas.ts`; keeping them here means the client
 * bundle never has to import the server-side schema module.
 */

export const MESSAGE_CHANNELS: readonly MessageChannel[] = ["whatsapp", "email", "instagram_dm"] as const;

export const MESSAGE_LENGTHS: readonly MessageLength[] = ["short", "medium", "long"] as const;

export const MESSAGE_STATUSES = ["draft", "edited", "copied", "channel_opened", "sent_manually", "archived"] as const;

export type MessageStatusValue = (typeof MESSAGE_STATUSES)[number];

export function isMessageChannel(value: unknown): value is MessageChannel {
  return typeof value === "string" && (MESSAGE_CHANNELS as readonly string[]).includes(value);
}

export function isMessageStatus(value: unknown): value is MessageStatusValue {
  return typeof value === "string" && (MESSAGE_STATUSES as readonly string[]).includes(value);
}
