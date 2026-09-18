import "server-only";

import { randomUUID } from "node:crypto";
import { start } from "workflow/api";

import { recordActivity } from "@/lib/activity";
import type { WorkspaceContext } from "@/lib/auth/context";
import { ConflictError, NotFoundError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { refreshBusinessWorkflow } from "@/lib/workflows/scan/refresh.workflow";
import type { BusinessRow } from "@/types/db";

/** Hides a business from the opportunity list without deleting its audit history. */
export async function setBusinessIgnored(ctx: WorkspaceContext, businessId: string, ignored: boolean): Promise<BusinessRow> {
  const { data, error } = await ctx.supabase
    .from("businesses")
    .update({ is_ignored: ignored, ignored_at: ignored ? new Date().toISOString() : null })
    .eq("id", businessId)
    .eq("workspace_id", ctx.workspace.id)
    .select("*")
    .maybeSingle<BusinessRow>();
  if (error) throw toAppError(error);
  if (!data) throw new NotFoundError("Business not found");

  await recordActivity(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    businessId,
    actorId: ctx.user.id,
    type: ignored ? "business_ignored" : "business_unignored",
  });
  return data;
}

export interface RefreshAuditResult {
  businessId: string;
  runId: string | null;
  queued: boolean;
}

/**
 * Re-runs the audit for one business.
 *
 * The work runs as a durable workflow using the same step the scan pipeline
 * uses, so a refresh produces identical audits, signals and scores. It is
 * charged as its own audit.
 */
export async function refreshBusinessAudit(ctx: WorkspaceContext, businessId: string): Promise<RefreshAuditResult> {
  const { data: business } = await ctx.supabase
    .from("businesses")
    .select("id, first_scan_id")
    .eq("id", businessId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<{ id: string; first_scan_id: string | null }>();
  if (!business) throw new NotFoundError("Business not found");

  // Work is always attributed to a scan, which is what owns the counters and the
  // credit reservation. A business always has one: discovery created it.
  const scanId = business.first_scan_id ?? (await latestScanIdFor(ctx, businessId));
  if (!scanId) throw new ConflictError("This business has no scan to attribute the audit to");

  const runKey = randomUUID();
  await ctx.supabase
    .from("scan_businesses")
    .update({ audit_status: "pending", opportunity_status: "pending" })
    .eq("scan_id", scanId)
    .eq("business_id", businessId);

  let runId: string | null = null;
  try {
    const run = await start(refreshBusinessWorkflow, [scanId, businessId, runKey]);
    runId = run.runId;
  } catch (err) {
    logger.error("refresh_workflow_start_failed", { businessId, scanId, error: err instanceof Error ? err.message : String(err) });
    throw toAppError(err);
  }

  await recordActivity(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    businessId,
    scanId,
    actorId: ctx.user.id,
    type: "audit_refreshed",
    metadata: { runId, runKey },
  });

  return { businessId, runId, queued: true };
}

async function latestScanIdFor(ctx: WorkspaceContext, businessId: string): Promise<string | null> {
  const { data } = await ctx.supabase
    .from("scan_businesses")
    .select("scan_id")
    .eq("business_id", businessId)
    .eq("workspace_id", ctx.workspace.id)
    .order("discovered_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ scan_id: string }>();
  return data?.scan_id ?? null;
}
