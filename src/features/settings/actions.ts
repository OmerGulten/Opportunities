"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { LOCALE_COOKIE, getRequestLocale, requireAuth, requireRole, requireWorkspaceContext } from "@/lib/auth/context";
import { completeMockPurchase, getSubscriptionProvider } from "@/lib/billing";
import { AppError } from "@/lib/errors";
import { getT } from "@/lib/i18n";
import { createLogger } from "@/lib/logging";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/workspace/schemas";
import type { ServiceOfferingRow } from "@/types/db";

import {
  createApiKeySchema,
  deleteAccountSchema,
  deleteWorkspaceSchema,
  inviteMemberSchema,
  offeringSchema,
  removeMemberSchema,
  revokeApiKeySchema,
  updateMemberSchema,
  updateOfferingSchema,
  workspaceProfileSchema,
  workspaceServicesSchema,
} from "./schemas";
import {
  createApiKey,
  createOffering,
  deleteAccount,
  deleteOffering,
  deleteWorkspace,
  inviteMember,
  removeMember,
  revokeApiKey,
  setWorkspaceServices,
  updateMemberRole,
  updateOffering,
  updateWorkspaceProfile,
  type CreatedApiKey,
  type PendingInvitation,
} from "./service";

/**
 * Server Actions for the settings area.
 *
 * Every action resolves the workspace from the session (never from the client),
 * validates its input with the feature's Zod schemas and returns the
 * `ActionResult` envelope from docs/conventions.md instead of throwing, so the
 * UI can show a localized sentence without ever seeing a stack trace.
 */

const log = createLogger({ scope: "settings.actions" });

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  locale: z.enum(["tr", "en"]),
});

const planChangeSchema = z.object({ planKey: z.string().trim().min(1).max(40) });
const packPurchaseSchema = z.object({ packKey: z.string().trim().min(1).max(40) });
const cancelSchema = z.object({ atPeriodEnd: z.boolean().default(true) });
const deleteOfferingSchema = z.object({ id: z.uuid() });

// ---------------------------------------------------------------------------
// result helpers
// ---------------------------------------------------------------------------

async function invalid(): Promise<ActionResult<never>> {
  const locale = await getRequestLocale();
  return { ok: false, error: { code: "validation_error", message: getT(locale, "errors")("validation_error") } };
}

/** Maps a thrown AppError to its localized sentence in the `errors` namespace. */
async function failed(scope: string, cause: unknown): Promise<ActionResult<never>> {
  const locale = await getRequestLocale();
  const tErrors = getT(locale, "errors");
  const fallback = getT(locale, "settings")("errors.saveFailed");

  if (cause instanceof AppError) {
    log.warn("settings_action_app_error", { scope, code: cause.code });
    const message = tErrors(cause.code);
    return { ok: false, error: { code: cause.code, message: message === cause.code ? fallback : message } };
  }

  log.error("settings_action_failed", { scope, error: cause instanceof Error ? cause.message : String(cause) });
  return { ok: false, error: { code: "internal_error", message: fallback } };
}

// ---------------------------------------------------------------------------
// profile (account level)
// ---------------------------------------------------------------------------

/**
 * Updates the signed-in user's own profile. The locale is written to the
 * profile *and* to the preference cookie, because the cookie is what the
 * request context reads first.
 */
export async function updateProfile(input: { displayName: string; locale: "tr" | "en" }): Promise<ActionResult<{ displayName: string; locale: "tr" | "en" }>> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireAuth();
    const { error } = await ctx.supabase
      .from("profiles")
      .update({ display_name: parsed.data.displayName, locale: parsed.data.locale })
      .eq("id", ctx.user.id);
    if (error) throw error;

    // A UI preference rather than a secret, and deliberately readable by
    // scripts: the locale switcher in the top bar writes the same cookie.
    const cookieStore = await cookies();
    cookieStore.set(LOCALE_COOKIE, parsed.data.locale, {
      sameSite: "lax",
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });

    revalidatePath("/", "layout");
    return { ok: true, data: parsed.data };
  } catch (error) {
    return failed("updateProfile", error);
  }
}

// ---------------------------------------------------------------------------
// workspace
// ---------------------------------------------------------------------------

export async function updateWorkspace(input: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = workspaceProfileSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireRole("admin");
    const workspace = await updateWorkspaceProfile(ctx, parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: workspace.id, name: workspace.name } };
  } catch (error) {
    return failed("updateWorkspace", error);
  }
}

// ---------------------------------------------------------------------------
// services and offerings
// ---------------------------------------------------------------------------

export async function updateWorkspaceServices(input: { serviceIds: string[] }): Promise<ActionResult<{ enabled: number }>> {
  const parsed = workspaceServicesSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireRole("admin");
    await setWorkspaceServices(ctx, parsed.data);
    revalidatePath("/settings/services");
    return { ok: true, data: { enabled: parsed.data.serviceIds.length } };
  } catch (error) {
    return failed("updateWorkspaceServices", error);
  }
}

export async function addOffering(input: unknown): Promise<ActionResult<ServiceOfferingRow>> {
  const parsed = offeringSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireRole("admin");
    const offering = await createOffering(ctx, parsed.data);
    revalidatePath("/settings/services");
    return { ok: true, data: offering };
  } catch (error) {
    return failed("addOffering", error);
  }
}

export async function editOffering(input: unknown): Promise<ActionResult<ServiceOfferingRow>> {
  const parsed = updateOfferingSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireRole("admin");
    const offering = await updateOffering(ctx, parsed.data);
    revalidatePath("/settings/services");
    return { ok: true, data: offering };
  } catch (error) {
    return failed("editOffering", error);
  }
}

export async function removeOffering(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteOfferingSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireRole("admin");
    await deleteOffering(ctx, parsed.data.id);
    revalidatePath("/settings/services");
    return { ok: true, data: { id: parsed.data.id } };
  } catch (error) {
    return failed("removeOffering", error);
  }
}

// ---------------------------------------------------------------------------
// team
// ---------------------------------------------------------------------------

/** Creates an invitation and returns its link. No e-mail is sent; the UI says so. */
export async function createInvitation(input: { email: string; role: "admin" | "member" }): Promise<ActionResult<PendingInvitation>> {
  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireRole("admin");
    const invitation = await inviteMember(ctx, parsed.data);
    revalidatePath("/settings/team");
    return { ok: true, data: invitation };
  } catch (error) {
    return failed("createInvitation", error);
  }
}

export async function changeMemberRole(input: { userId: string; role: "owner" | "admin" | "member" }): Promise<ActionResult<{ userId: string }>> {
  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireRole("admin");
    await updateMemberRole(ctx, parsed.data);
    revalidatePath("/settings/team");
    return { ok: true, data: { userId: parsed.data.userId } };
  } catch (error) {
    return failed("changeMemberRole", error);
  }
}

export async function removeTeamMember(input: { userId: string }): Promise<ActionResult<{ userId: string }>> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireRole("admin");
    await removeMember(ctx, parsed.data);
    revalidatePath("/settings/team");
    return { ok: true, data: { userId: parsed.data.userId } };
  } catch (error) {
    return failed("removeTeamMember", error);
  }
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

/** The plaintext key exists only in this response; the database keeps a hash. */
export async function createWorkspaceApiKey(input: { name: string }): Promise<ActionResult<CreatedApiKey>> {
  const parsed = createApiKeySchema.safeParse({ name: input.name, scopes: [] });
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireRole("admin");
    const key = await createApiKey(ctx, parsed.data);
    revalidatePath("/settings/api-keys");
    return { ok: true, data: key };
  } catch (error) {
    return failed("createWorkspaceApiKey", error);
  }
}

export async function revokeWorkspaceApiKey(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  const parsed = revokeApiKeySchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireRole("admin");
    await revokeApiKey(ctx, parsed.data.id);
    revalidatePath("/settings/api-keys");
    return { ok: true, data: { id: parsed.data.id } };
  } catch (error) {
    return failed("revokeWorkspaceApiKey", error);
  }
}

// ---------------------------------------------------------------------------
// billing
// ---------------------------------------------------------------------------

export async function changePlan(input: { planKey: string }): Promise<ActionResult<{ planKey: string }>> {
  const parsed = planChangeSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireRole("admin");
    const subscription = await getSubscriptionProvider().changePlan({
      workspaceId: ctx.workspace.id,
      planKey: parsed.data.planKey,
      actorId: ctx.user.id,
    });
    revalidatePath("/settings/billing");
    revalidatePath("/", "layout");
    return { ok: true, data: { planKey: subscription.planKey } };
  } catch (error) {
    return failed("changePlan", error);
  }
}

export async function cancelSubscription(input: { atPeriodEnd?: boolean } = {}): Promise<ActionResult<{ cancelAtPeriodEnd: boolean; currentPeriodEnd: string }>> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireRole("admin");
    const subscription = await getSubscriptionProvider().cancel({
      workspaceId: ctx.workspace.id,
      atPeriodEnd: parsed.data.atPeriodEnd,
      actorId: ctx.user.id,
    });
    revalidatePath("/settings/billing");
    return { ok: true, data: { cancelAtPeriodEnd: subscription.cancelAtPeriodEnd, currentPeriodEnd: subscription.currentPeriodEnd } };
  } catch (error) {
    return failed("cancelSubscription", error);
  }
}

/**
 * Applies a credit pack. While real payments are off this is the mock provider:
 * credits land immediately and no money moves — the billing page says so.
 */
export async function buyCreditPack(input: { packKey: string }): Promise<ActionResult<{ credits: number }>> {
  const parsed = packPurchaseSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireRole("admin");
    const result = await completeMockPurchase({
      workspaceId: ctx.workspace.id,
      packKey: parsed.data.packKey,
      actorId: ctx.user.id,
      reference: crypto.randomUUID(),
    });
    revalidatePath("/settings/billing");
    revalidatePath("/", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return failed("buyCreditPack", error);
  }
}

// ---------------------------------------------------------------------------
// deletion
// ---------------------------------------------------------------------------

/** Owner only, and the typed name must match exactly. Irreversible. */
export async function deleteCurrentWorkspace(input: { confirmName: string }): Promise<ActionResult<never>> {
  const parsed = deleteWorkspaceSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireWorkspaceContext();
    await deleteWorkspace(ctx, parsed.data);
  } catch (error) {
    return failed("deleteCurrentWorkspace", error);
  }

  // Outside the try block: redirect() signals through an exception.
  revalidatePath("/", "layout");
  redirect("/onboarding");
}

/** Deletes the signed-in user's account, then ends the session. Irreversible. */
export async function deleteCurrentAccount(input: { confirm: string }): Promise<ActionResult<never>> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return invalid();

  try {
    const ctx = await requireWorkspaceContext();
    await deleteAccount(ctx);
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    return failed("deleteCurrentAccount", error);
  }

  redirect("/");
}
