import { z } from "zod";

export const createReportSchema = z.object({
  businessId: z.uuid(),
  title: z.string().trim().max(160).optional(),
  locale: z.enum(["tr", "en"]).optional(),
  /** Reports contain provider-derived observations; keep their lifetime finite. */
  expiresInDays: z.number().int().min(1).max(30).default(30),
});

export type CreateReportRequest = z.infer<typeof createReportSchema>;

export const revokeReportSchema = z.object({
  reportId: z.uuid(),
});

export type RevokeReportRequest = z.infer<typeof revokeReportSchema>;

export const listReportsQuerySchema = z.object({
  businessId: z.uuid().optional(),
});

export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;

/** Public report tokens are 32 random bytes, base64url encoded. */
export const reportTokenSchema = z
  .string()
  .min(32)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid report token");
