import { z } from "zod";

/** Pipeline and lead validation. No probability fields: we track facts, not forecasts. */

export const leadStatusSchema = z.enum(["open", "won", "lost", "archived"]);

export const createLeadSchema = z.object({
  businessId: z.uuid(),
  /** Defaults to the workspace's first stage when omitted. */
  stageId: z.uuid().optional(),
  primaryServiceId: z.uuid().nullable().optional(),
  estimatedValue: z.number().min(0).max(100_000_000).nullable().optional(),
  ownerId: z.uuid().nullable().optional(),
  sourceScanId: z.uuid().nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export type CreateLeadRequest = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z
  .object({
    stageId: z.uuid().optional(),
    status: leadStatusSchema.optional(),
    ownerId: z.uuid().nullable().optional(),
    primaryServiceId: z.uuid().nullable().optional(),
    estimatedValue: z.number().min(0).max(100_000_000).nullable().optional(),
    wonValue: z.number().min(0).max(100_000_000).nullable().optional(),
    currency: z.string().length(3).optional(),
    lossReason: z.string().trim().max(500).nullable().optional(),
    nextFollowUpAt: z.iso.datetime({ offset: true }).nullable().optional(),
    lastContactedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

export type UpdateLeadRequest = z.infer<typeof updateLeadSchema>;

export const addNoteSchema = z.object({
  leadId: z.uuid(),
  body: z.string().trim().min(1).max(4000),
});

export type AddNoteRequest = z.infer<typeof addNoteSchema>;

export const scheduleFollowUpSchema = z.object({
  leadId: z.uuid(),
  /** Null clears the reminder. */
  nextFollowUpAt: z.iso.datetime({ offset: true }).nullable(),
  note: z.string().trim().max(500).nullable().optional(),
});

export type ScheduleFollowUpRequest = z.infer<typeof scheduleFollowUpSchema>;

export const listLeadsQuerySchema = z.object({
  stageId: z.uuid().optional(),
  status: leadStatusSchema.optional(),
  ownerId: z.uuid().optional(),
  q: z.string().trim().max(120).optional(),
  dueOnly: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
