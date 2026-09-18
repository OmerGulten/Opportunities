import { z } from "zod";

/**
 * Validation messages are stable keys rendered through the `auth.validation`
 * i18n namespace, so the same schema serves both locales.
 */
export const emailSchema = z.string().trim().min(1, { message: "emailRequired" }).email({ message: "emailInvalid" });

export const passwordSchema = z.string().min(8, { message: "passwordMin" }).max(200);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "passwordRequired" }),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const magicLinkSchema = z.object({
  email: emailSchema,
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

export const signUpSchema = z.object({
  displayName: z.string().trim().min(2, { message: "displayNameMin" }).max(80),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.boolean().refine((value) => value === true, { message: "termsRequired" }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, { message: "passwordRequired" }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordsDoNotMatch",
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Only same-origin, absolute-path redirects are honoured after sign-in so a
 * crafted `?next=` cannot bounce a user to another site.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** Reads a single value out of Next's `string | string[]` search params. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
