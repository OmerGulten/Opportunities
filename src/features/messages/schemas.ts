import { z } from "zod";

/** Validation for outreach drafting. Shared by the API routes and the client form. */

export const messageChannelSchema = z.enum(["whatsapp", "email", "instagram_dm"]);
export const toneSchema = z.enum(["friendly_professional", "formal", "casual", "concise"]);
export const messageLengthSchema = z.enum(["short", "medium", "long"]);
export const localeSchema = z.enum(["tr", "en"]);

export const generateMessageSchema = z.object({
  businessId: z.uuid(),
  channel: messageChannelSchema,
  serviceId: z.uuid().nullable().optional(),
  templateId: z.uuid().nullable().optional(),
  tone: toneSchema.optional(),
  length: messageLengthSchema.optional(),
  locale: localeSchema.optional(),
  includeReportLink: z.boolean().default(false),
  /** Free-text steer from the user. Treated as user content, never as system instructions. */
  instruction: z.string().trim().max(500).nullable().optional(),
});

export type GenerateMessageRequest = z.infer<typeof generateMessageSchema>;

export const saveMessageSchema = z.object({
  businessId: z.uuid(),
  channel: messageChannelSchema,
  body: z.string().trim().min(1).max(5000),
  subject: z.string().trim().max(200).nullable().optional(),
  serviceId: z.uuid().nullable().optional(),
  templateId: z.uuid().nullable().optional(),
  generationId: z.uuid().nullable().optional(),
  tone: toneSchema.nullable().optional(),
  /** True when the user changed the generated text before saving. */
  edited: z.boolean().default(false),
});

export type SaveMessageRequest = z.infer<typeof saveMessageSchema>;

export const messageStatusSchema = z.enum(["draft", "edited", "copied", "channel_opened", "sent_manually", "archived"]);

export const updateMessageStatusSchema = z.object({
  messageId: z.uuid(),
  status: messageStatusSchema,
});

export type UpdateMessageStatusRequest = z.infer<typeof updateMessageStatusSchema>;

export const listMessagesQuerySchema = z.object({
  businessId: z.uuid().optional(),
  channel: messageChannelSchema.optional(),
  status: messageStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
