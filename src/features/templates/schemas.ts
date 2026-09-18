import { z } from "zod";

import { MESSAGE_VARIABLE_KEYS } from "@/features/messages/variables";

export const templateScopeSchema = z.enum(["system", "workspace", "personal"]);
export const templateChannelSchema = z.enum(["whatsapp", "email", "instagram_dm"]);

/** Rejects a body that references a variable we cannot resolve from verified data. */
const bodyWithKnownVariables = z
  .string()
  .trim()
  .min(1)
  .max(6000)
  .superRefine((value, ctx) => {
    const used = [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]);
    const unknown = [...new Set(used)].filter((key) => !MESSAGE_VARIABLE_KEYS.includes(key));
    if (unknown.length > 0) {
      ctx.addIssue({ code: "custom", message: `Unknown variables: ${unknown.join(", ")}` });
    }
  });

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  channel: templateChannelSchema,
  /** Personal templates are private to their author; workspace templates are shared. */
  scope: z.enum(["workspace", "personal"]).default("workspace"),
  serviceId: z.uuid().nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  tone: z.enum(["friendly_professional", "formal", "casual", "concise"]).default("friendly_professional"),
  locale: z.enum(["tr", "en"]).default("tr"),
  subject: z.string().trim().max(200).nullable().optional(),
  body: bodyWithKnownVariables,
  active: z.boolean().default(true),
});

export type CreateTemplateRequest = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema.partial().extend({
  body: bodyWithKnownVariables.optional(),
});

export type UpdateTemplateRequest = z.infer<typeof updateTemplateSchema>;

export const listTemplatesQuerySchema = z.object({
  channel: templateChannelSchema.optional(),
  serviceId: z.uuid().optional(),
  scope: templateScopeSchema.optional(),
  locale: z.enum(["tr", "en"]).optional(),
  activeOnly: z.coerce.boolean().default(true),
});

export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;
