import { z } from "zod";

/** Platform-admin actions. Every one of these is audited through the credit ledger or billing_events. */

export const grantCreditsSchema = z.object({
  workspaceId: z.uuid(),
  amount: z.number().int().min(1).max(1_000_000),
  /** Negative adjustments use the same endpoint with direction "debit". */
  direction: z.enum(["credit", "debit"]).default("credit"),
  reason: z.string().trim().min(3).max(300),
});

export type GrantCreditsRequest = z.infer<typeof grantCreditsSchema>;

export const updatePricingSchema = z.object({
  rules: z
    .array(
      z.object({
        key: z.string().min(1).max(60),
        cost: z.number().int().min(0).max(1000),
        active: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(50),
});

export type UpdatePricingRequest = z.infer<typeof updatePricingSchema>;

export const updateServiceRuleSchema = z.object({
  ruleId: z.uuid(),
  points: z.number().int().min(0).max(100).optional(),
  active: z.boolean().optional(),
  minConfidence: z.enum(["high", "medium", "low"]).optional(),
  requiresDepth: z.enum(["discovery", "basic", "deep"]).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export type UpdateServiceRuleRequest = z.infer<typeof updateServiceRuleSchema>;

export const toggleServiceSchema = z.object({
  serviceId: z.uuid(),
  active: z.boolean(),
});

export type ToggleServiceRequest = z.infer<typeof toggleServiceSchema>;

export const updateFeatureFlagsSchema = z.object({
  flags: z.record(z.string().min(1).max(60), z.boolean()),
});

export type UpdateFeatureFlagsRequest = z.infer<typeof updateFeatureFlagsSchema>;

export const listWorkspacesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListWorkspacesQuery = z.infer<typeof listWorkspacesQuerySchema>;

export const listFailedJobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  scanId: z.uuid().optional(),
});

export type ListFailedJobsQuery = z.infer<typeof listFailedJobsQuerySchema>;
