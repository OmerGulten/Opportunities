"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";

import { CURRENT_WORKSPACE_COOKIE, getRequestLocale, requireAuth, requireWorkspaceContext } from "@/lib/auth/context";
import type { ErrorCode } from "@/lib/errors";
import { AppError } from "@/lib/errors";
import { getT } from "@/lib/i18n";
import { createLogger } from "@/lib/logging";
import { randomSuffix, slugify } from "@/lib/utils/slug";
import type { ServiceRow, WorkspaceMemberRow } from "@/types/db";

import {
  createWorkspaceSchema,
  displayNameSchema,
  saveOfferingsSchema,
  switchWorkspaceSchema,
  workspaceProfileSchema,
  workspaceServicesSchema,
  type ActionResult,
} from "./schemas";

const log = createLogger({ scope: "workspace.actions" });

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

async function translate(): Promise<(key: string, params?: Record<string, string | number>) => string> {
  const locale = await getRequestLocale();
  return getT(locale, "onboarding");
}

function fail(code: ErrorCode, message: string): ActionResult<never> {
  return { ok: false, error: { code, message } };
}

/** Maps the first Zod issue (a stable message key) to a localized sentence. */
async function failValidation(error: ZodError): Promise<ActionResult<never>> {
  const t = await translate();
  const key = error.issues[0]?.message ?? "saveFailed";
  const message = t(`errors.${key}`);
  return fail("validation_error", message === `errors.${key}` ? t("errors.saveFailed") : message);
}

async function failUnexpected(scope: string, cause: unknown): Promise<ActionResult<never>> {
  const t = await translate();
  if (cause instanceof AppError) {
    log.warn("action_app_error", { scope, code: cause.code });
    return fail(cause.code, t("errors.saveFailed"));
  }
  log.error("action_failed", { scope, error: cause instanceof Error ? cause.message : String(cause) });
  return fail("internal_error", t("errors.saveFailed"));
}

async function setCurrentWorkspaceCookie(workspaceId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CURRENT_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Switches the active workspace. The cookie is only a preference: membership is
 * verified here and again by getWorkspaceContext() on every request.
 */
export async function switchWorkspace(workspaceId: string): Promise<ActionResult<never>> {
  const parsed = switchWorkspaceSchema.safeParse({ workspaceId });
  if (!parsed.success) return failValidation(parsed.error);

  try {
    const ctx = await requireWorkspaceContext();
    const { data: membership } = await ctx.supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", parsed.data.workspaceId)
      .eq("user_id", ctx.user.id)
      .maybeSingle<Pick<WorkspaceMemberRow, "workspace_id">>();

    if (!membership) {
      const t = await translate();
      return fail("forbidden", t("errors.noWorkspace"));
    }
    await setCurrentWorkspaceCookie(parsed.data.workspaceId);
  } catch (error) {
    return failUnexpected("switchWorkspace", error);
  }

  redirect("/dashboard");
}

/**
 * Creates a workspace through create_workspace_with_defaults (plan, credit
 * account, pipeline stages, workspace services) and makes it current.
 */
export async function createWorkspace(input: { name: string }): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  try {
    const ctx = await requireAuth();
    const base = slugify(parsed.data.name);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = `${base}-${randomSuffix(4)}`;
      const { data, error } = await ctx.supabase.rpc("create_workspace_with_defaults", { p_name: parsed.data.name, p_slug: slug });

      if (!error && typeof data === "string") {
        await setCurrentWorkspaceCookie(data);
        log.info("workspace_created", { workspace_id: data });
        return { ok: true, data: { id: data, slug } };
      }
      // 23505 = unique_violation on workspaces.slug -> retry with a new suffix.
      if (error && error.code !== "23505") {
        return failUnexpected("createWorkspace", new Error(error.message));
      }
    }

    const t = await translate();
    return fail("conflict", t("errors.createFailed"));
  } catch (error) {
    return failUnexpected("createWorkspace", error);
  }
}

/** Enables exactly the selected services for the current workspace. */
export async function saveWorkspaceServices(input: { serviceIds: string[] }): Promise<ActionResult<{ enabled: number }>> {
  const parsed = workspaceServicesSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  try {
    const ctx = await requireWorkspaceContext();
    const { data: services, error: servicesError } = await ctx.supabase
      .from("services")
      .select("id")
      .eq("active", true)
      .returns<Array<Pick<ServiceRow, "id">>>();
    if (servicesError) return failUnexpected("saveWorkspaceServices", new Error(servicesError.message));

    const selected = new Set(parsed.data.serviceIds);
    const rows = (services ?? []).map((service) => ({
      workspace_id: ctx.workspace.id,
      service_id: service.id,
      enabled: selected.has(service.id),
      priority: selected.has(service.id) ? parsed.data.serviceIds.indexOf(service.id) + 1 : 0,
    }));

    if (rows.length > 0) {
      const { error } = await ctx.supabase.from("workspace_services").upsert(rows, { onConflict: "workspace_id,service_id" });
      if (error) return failUnexpected("saveWorkspaceServices", new Error(error.message));
    }

    return { ok: true, data: { enabled: selected.size } };
  } catch (error) {
    return failUnexpected("saveWorkspaceServices", error);
  }
}

/**
 * Replaces the offerings of the services present in the payload. Re-submitting
 * the same wizard step is therefore idempotent.
 */
export async function saveOfferings(input: {
  offerings: Array<{
    serviceId: string;
    name: string;
    priceFrom: number | null;
    priceTo: number | null;
    currency?: string;
    billingPeriod: "one_time" | "monthly" | "yearly";
    deliveryTime: string | null;
  }>;
}): Promise<ActionResult<{ saved: number }>> {
  const parsed = saveOfferingsSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  try {
    const ctx = await requireWorkspaceContext();
    const serviceIds = [...new Set(parsed.data.offerings.map((offering) => offering.serviceId))];
    if (serviceIds.length === 0) return { ok: true, data: { saved: 0 } };

    const { error: deleteError } = await ctx.supabase
      .from("service_offerings")
      .delete()
      .eq("workspace_id", ctx.workspace.id)
      .in("service_id", serviceIds);
    if (deleteError) return failUnexpected("saveOfferings", new Error(deleteError.message));

    const rows = parsed.data.offerings.map((offering, index) => ({
      workspace_id: ctx.workspace.id,
      service_id: offering.serviceId,
      name: offering.name,
      price_from: offering.priceFrom,
      price_to: offering.priceTo,
      currency: offering.currency,
      billing_period: offering.billingPeriod,
      delivery_time: offering.deliveryTime,
      enabled: true,
      sort_order: (index + 1) * 10,
    }));

    const { error } = await ctx.supabase.from("service_offerings").insert(rows);
    if (error) return failUnexpected("saveOfferings", new Error(error.message));

    return { ok: true, data: { saved: rows.length } };
  } catch (error) {
    return failUnexpected("saveOfferings", error);
  }
}

/** Default tone plus the optional sender / company details used in drafts. */
export async function saveWorkspaceProfile(input: {
  defaultTone: string;
  senderName: string | null;
  senderTitle: string | null;
  senderPhone: string | null;
  senderEmail: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  companyDescription: string | null;
}): Promise<ActionResult<{ workspaceId: string }>> {
  const parsed = workspaceProfileSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  try {
    const ctx = await requireWorkspaceContext();
    const { error } = await ctx.supabase
      .from("workspaces")
      .update({
        default_tone: parsed.data.defaultTone,
        sender_name: parsed.data.senderName,
        sender_title: parsed.data.senderTitle,
        sender_phone: parsed.data.senderPhone,
        sender_email: parsed.data.senderEmail,
        company_name: parsed.data.companyName,
        company_website: parsed.data.companyWebsite,
        company_description: parsed.data.companyDescription,
      })
      .eq("id", ctx.workspace.id);
    if (error) return failUnexpected("saveWorkspaceProfile", new Error(error.message));

    return { ok: true, data: { workspaceId: ctx.workspace.id } };
  } catch (error) {
    return failUnexpected("saveWorkspaceProfile", error);
  }
}

/** Updates the signed-in user's display name (account level, not workspace). */
export async function saveDisplayName(input: { displayName: string }): Promise<ActionResult<{ displayName: string }>> {
  const parsed = displayNameSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  try {
    const ctx = await requireAuth();
    const { error } = await ctx.supabase.from("profiles").update({ display_name: parsed.data.displayName }).eq("id", ctx.user.id);
    if (error) return failUnexpected("saveDisplayName", new Error(error.message));
    return { ok: true, data: { displayName: parsed.data.displayName } };
  } catch (error) {
    return failUnexpected("saveDisplayName", error);
  }
}

/** Marks onboarding as finished for the signed-in user. */
export async function completeOnboarding(): Promise<ActionResult<{ completedAt: string }>> {
  try {
    const ctx = await requireAuth();
    const completedAt = new Date().toISOString();
    const { error } = await ctx.supabase.from("profiles").update({ onboarding_completed_at: completedAt }).eq("id", ctx.user.id);
    if (error) return failUnexpected("completeOnboarding", new Error(error.message));
    return { ok: true, data: { completedAt } };
  } catch (error) {
    return failUnexpected("completeOnboarding", error);
  }
}
