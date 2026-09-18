import { z } from "zod";

/** Settings validation: workspace profile, team, offerings, API keys, deletion. */

export const workspaceProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  defaultLocale: z.enum(["tr", "en"]).optional(),
  defaultTone: z.enum(["friendly_professional", "formal", "casual", "concise"]).optional(),
  senderName: z.string().trim().max(120).nullable().optional(),
  senderTitle: z.string().trim().max(120).nullable().optional(),
  senderPhone: z.string().trim().max(40).nullable().optional(),
  senderEmail: z.email().nullable().optional(),
  companyName: z.string().trim().max(120).nullable().optional(),
  companyWebsite: z.url().nullable().optional(),
  companyDescription: z.string().trim().max(1000).nullable().optional(),
  brandPrimaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #0f766e")
    .nullable()
    .optional(),
  logoUrl: z.url().nullable().optional(),
});

export type WorkspaceProfileRequest = z.infer<typeof workspaceProfileSchema>;

export const inviteMemberSchema = z.object({
  email: z.email(),
  role: z.enum(["admin", "member"]).default("member"),
});

export type InviteMemberRequest = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["owner", "admin", "member"]),
});

export type UpdateMemberRequest = z.infer<typeof updateMemberSchema>;

export const removeMemberSchema = z.object({
  userId: z.uuid(),
});

export type RemoveMemberRequest = z.infer<typeof removeMemberSchema>;

export const offeringSchema = z.object({
  serviceId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  priceFrom: z.number().min(0).max(10_000_000).nullable().optional(),
  priceTo: z.number().min(0).max(10_000_000).nullable().optional(),
  currency: z.string().length(3).default("TRY"),
  billingPeriod: z.enum(["one_time", "monthly", "yearly"]).default("one_time"),
  deliveryTime: z.string().trim().max(80).nullable().optional(),
  promptContext: z.string().trim().max(1000).nullable().optional(),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export type OfferingRequest = z.infer<typeof offeringSchema>;

export const updateOfferingSchema = offeringSchema.partial().extend({ id: z.uuid() });
export type UpdateOfferingRequest = z.infer<typeof updateOfferingSchema>;

export const workspaceServicesSchema = z.object({
  serviceIds: z.array(z.uuid()).max(50),
});

export type WorkspaceServicesRequest = z.infer<typeof workspaceServicesSchema>;

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(80),
  scopes: z.array(z.string().min(1).max(40)).max(20).default([]),
});

export type CreateApiKeyRequest = z.infer<typeof createApiKeySchema>;

export const revokeApiKeySchema = z.object({ id: z.uuid() });
export type RevokeApiKeyRequest = z.infer<typeof revokeApiKeySchema>;

/** Deletion is irreversible, so the user must type the exact name to confirm. */
export const deleteWorkspaceSchema = z.object({
  confirmName: z.string().trim().min(1).max(120),
});

export type DeleteWorkspaceRequest = z.infer<typeof deleteWorkspaceSchema>;

export const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE"),
});

export type DeleteAccountRequest = z.infer<typeof deleteAccountSchema>;
