import { z } from "zod";

import type { ErrorCode } from "@/lib/errors";
import type { Tone } from "@/types/common";

/**
 * Server Actions never throw to the client (docs/conventions.md). They return
 * this envelope; `message` is already localized for the request locale.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } };

/**
 * Validation messages are stable *keys*, not sentences: the UI renders them
 * through the `onboarding.errors` namespace so both locales stay in sync.
 */
export const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, { message: "nameTooShort" })
  .max(60, { message: "nameTooLong" });

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const switchWorkspaceSchema = z.object({
  workspaceId: z.string().uuid({ message: "invalidId" }),
});
export type SwitchWorkspaceInput = z.infer<typeof switchWorkspaceSchema>;

export const displayNameSchema = z.object({
  displayName: z.string().trim().min(2, { message: "displayNameRequired" }).max(80, { message: "displayNameRequired" }),
});
export type DisplayNameInput = z.infer<typeof displayNameSchema>;

export const workspaceServicesSchema = z.object({
  serviceIds: z.array(z.string().uuid({ message: "invalidId" })).min(1, { message: "atLeastOneService" }).max(50),
});
export type WorkspaceServicesInput = z.infer<typeof workspaceServicesSchema>;

export const billingPeriodSchema = z.enum(["one_time", "monthly", "yearly"]);

const priceSchema = z
  .number({ message: "priceInvalid" })
  .min(0, { message: "priceInvalid" })
  .max(100_000_000, { message: "priceInvalid" })
  .nullable();

export const offeringSchema = z
  .object({
    serviceId: z.string().uuid({ message: "invalidId" }),
    name: z.string().trim().min(1, { message: "offeringNameRequired" }).max(120, { message: "offeringNameRequired" }),
    priceFrom: priceSchema,
    priceTo: priceSchema,
    currency: z.string().trim().length(3, { message: "currencyInvalid" }).default("TRY"),
    billingPeriod: billingPeriodSchema,
    deliveryTime: z.string().trim().max(80).nullable(),
  })
  .refine((offering) => offering.priceFrom === null || offering.priceTo === null || offering.priceTo >= offering.priceFrom, {
    path: ["priceTo"],
    message: "priceRange",
  });
export type OfferingInput = z.infer<typeof offeringSchema>;

export const saveOfferingsSchema = z.object({
  offerings: z.array(offeringSchema).max(50),
});
export type SaveOfferingsInput = z.infer<typeof saveOfferingsSchema>;

/** Kept in step with the `Tone` union in src/types/common.ts. */
export const toneSchema = z.enum(["friendly_professional", "formal", "casual", "concise"] as const satisfies readonly Tone[]);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value === null || value.length === 0 ? null : value));

export const workspaceProfileSchema = z.object({
  defaultTone: toneSchema,
  senderName: optionalText(120),
  senderTitle: optionalText(120),
  senderPhone: optionalText(40),
  senderEmail: z
    .union([z.string().trim().email({ message: "emailInvalid" }), z.literal(""), z.null()])
    .transform((value) => (value === null || value === "" ? null : value)),
  companyName: optionalText(160),
  companyWebsite: z
    .union([z.string().trim().url({ message: "urlInvalid" }), z.literal(""), z.null()])
    .transform((value) => (value === null || value === "" ? null : value))
    .refine((value) => value === null || value.startsWith("http://") || value.startsWith("https://"), { message: "urlInvalid" }),
  companyDescription: optionalText(1000),
});
export type WorkspaceProfileInput = z.infer<typeof workspaceProfileSchema>;

const RESERVED_SLUGS = new Set(["admin", "api", "auth", "app", "settings", "dashboard", "report", "sign-in", "sign-up", "onboarding", "legal"]);

/**
 * Slugs that collide with top-level routes. The workspace slug always gets a
 * random suffix, so this only guards the displayed preview.
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
