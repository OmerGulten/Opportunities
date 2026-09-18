"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { cancelScan, retryScan } from "@/features/scans/service";
import type { ActionResult } from "@/features/workspace/schemas";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { AppError, type ErrorCode } from "@/lib/errors";
import { getT } from "@/lib/i18n";
import { createLogger } from "@/lib/logging";
import type { ScanStatus } from "@/types/common";

/**
 * Scan server actions. They exist so the list and detail pages can cancel or
 * retry a scan and have the server re-render with the new state, without the
 * client having to re-fetch. Input is validated here as well; the service
 * re-checks ownership and the state machine.
 */

const log = createLogger({ scope: "scans.actions" });

const scanIdSchema = z.uuid();

async function fail(code: ErrorCode): Promise<ActionResult<never>> {
  const t = getT(await getRequestLocale(), "errors");
  const message = t(code);
  return { ok: false, error: { code, message: message === code ? t("generic") : message } };
}

async function failFrom(scope: string, cause: unknown): Promise<ActionResult<never>> {
  if (cause instanceof AppError) {
    log.warn("scan_action_app_error", { scope, code: cause.code });
    return fail(cause.code);
  }
  log.error("scan_action_failed", { scope, error: cause instanceof Error ? cause.message : String(cause) });
  return fail("internal_error");
}

function revalidateScan(scanId: string): void {
  revalidatePath("/scans");
  revalidatePath(`/scans/${scanId}`);
}

/** Stops a running scan and releases its credit reservation. */
export async function cancelScanAction(scanId: string): Promise<ActionResult<{ id: string; status: ScanStatus }>> {
  const parsed = scanIdSchema.safeParse(scanId);
  if (!parsed.success) return fail("validation_error");

  try {
    const ctx = await requireWorkspaceContext();
    const scan = await cancelScan(ctx, parsed.data);
    revalidateScan(parsed.data);
    return { ok: true, data: { id: scan.id, status: scan.status } };
  } catch (error) {
    return failFrom("cancel", error);
  }
}

/** Restarts a failed, cancelled or partially completed scan. */
export async function retryScanAction(scanId: string): Promise<ActionResult<{ id: string; status: ScanStatus }>> {
  const parsed = scanIdSchema.safeParse(scanId);
  if (!parsed.success) return fail("validation_error");

  try {
    const ctx = await requireWorkspaceContext();
    const scan = await retryScan(ctx, parsed.data);
    revalidateScan(parsed.data);
    return { ok: true, data: { id: scan.id, status: scan.status } };
  } catch (error) {
    return failFrom("retry", error);
  }
}
