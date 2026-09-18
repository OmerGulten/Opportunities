"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { adjustCredits, toggleService, updateCreditPricing, updateFeatureFlags, updateServiceRule } from "@/features/admin/service";
import {
  grantCreditsSchema,
  toggleServiceSchema,
  updateFeatureFlagsSchema,
  updatePricingSchema,
  updateServiceRuleSchema,
} from "@/features/admin/schemas";
import { getRequestLocale, requirePlatformAdmin, type AuthContext } from "@/lib/auth/context";
import { AppError, type ErrorCode } from "@/lib/errors";
import { getT } from "@/lib/i18n";
import { createLogger } from "@/lib/logging";

/**
 * Platform-admin server actions.
 *
 * Every one of them re-checks `requirePlatformAdmin()` on the server: the admin
 * UI being reachable is never the authorisation. Nothing throws to the client —
 * failures come back as a localized `{ ok: false }` envelope so the caller can
 * render the message next to the control that produced it.
 */

const log = createLogger({ scope: "admin.actions" });

export type AdminActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } };

async function localizedError(code: ErrorCode): Promise<AdminActionResult<never>> {
  const locale = await getRequestLocale();
  const t = getT(locale, "errors");
  const message = t(code);
  return { ok: false, error: { code, message: message === code ? t("internal_error") : message } };
}

/** Auth check, validation and error mapping shared by every action below. */
async function run<Schema extends z.ZodType, T>(
  scope: string,
  schema: Schema,
  input: unknown,
  handler: (ctx: AuthContext, data: z.output<Schema>) => Promise<T>,
): Promise<AdminActionResult<T>> {
  let ctx: AuthContext;
  try {
    ctx = await requirePlatformAdmin();
  } catch (err) {
    const code: ErrorCode = err instanceof AppError ? err.code : "forbidden";
    log.warn("admin_action_denied", { scope, code });
    return localizedError(code);
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    log.warn("admin_action_invalid", { scope, issues: parsed.error.issues.length });
    return localizedError("validation_error");
  }

  try {
    return { ok: true, data: await handler(ctx, parsed.data) };
  } catch (err) {
    if (err instanceof AppError) {
      log.warn("admin_action_app_error", { scope, code: err.code });
      return localizedError(err.code);
    }
    log.error("admin_action_failed", { scope, error: err instanceof Error ? err.message : String(err) });
    return localizedError("internal_error");
  }
}

export interface CreditAdjustmentResult {
  balanceAfter: number;
  amount: number;
  direction: "credit" | "debit";
}

/** Grants or removes credits. Both directions land in the immutable ledger with the reason. */
export async function adjustWorkspaceCreditsAction(input: unknown): Promise<AdminActionResult<CreditAdjustmentResult>> {
  return run("adjustCredits", grantCreditsSchema, input, async (ctx, data) => {
    const entry = await adjustCredits(ctx, data);
    revalidatePath("/admin/workspaces");
    revalidatePath("/admin");
    return { balanceAfter: entry.balance_after, amount: data.amount, direction: data.direction };
  });
}

/** Updates the credit cost of one or more operations. Future operations only. */
export async function updateCreditPricingAction(input: unknown): Promise<AdminActionResult<{ updated: number }>> {
  return run("updatePricing", updatePricingSchema, input, async (ctx, data) => {
    await updateCreditPricing(ctx, data);
    revalidatePath("/admin/credit-rules");
    return { updated: data.rules.length };
  });
}

/**
 * Edits one scoring rule. The service bumps `service_rules.version`, so existing
 * opportunities keep the version they were scored with and are not rewritten.
 */
export async function updateScoringRuleAction(input: unknown): Promise<AdminActionResult<{ ruleId: string; version: number }>> {
  return run("updateRule", updateServiceRuleSchema, input, async (ctx, data) => {
    const rule = await updateServiceRule(ctx, data);
    revalidatePath("/admin/scoring-rules");
    return { ruleId: rule.id, version: rule.version };
  });
}

/** Enables or disables a sellable service platform-wide. */
export async function toggleServiceAction(input: unknown): Promise<AdminActionResult<{ serviceId: string; active: boolean }>> {
  return run("toggleService", toggleServiceSchema, input, async (ctx, data) => {
    const service = await toggleService(ctx, data);
    revalidatePath("/admin/services");
    revalidatePath("/admin/scoring-rules");
    return { serviceId: service.id, active: service.active };
  });
}

/** Toggles platform feature flags. */
export async function updateFeatureFlagsAction(input: unknown): Promise<AdminActionResult<Record<string, boolean>>> {
  return run("updateFlags", updateFeatureFlagsSchema, input, async (ctx, data) => {
    const flags = await updateFeatureFlags(ctx, data);
    revalidatePath("/admin/feature-flags");
    revalidatePath("/admin/providers");
    return flags;
  });
}
