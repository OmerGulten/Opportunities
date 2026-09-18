import "server-only";

import { getRun, start } from "workflow/api";

import { recordActivity } from "@/lib/activity";
import type { WorkspaceContext } from "@/lib/auth/context";
import { creditKeys, REFERENCE_TYPES } from "@/lib/credits/keys";
import { estimateBusinessCount, estimateScanCredits, type ScanCreditEstimate } from "@/lib/credits/pricing";
import { getCreditService, loadPricingTable } from "@/lib/credits/server";
import { getFeatureFlags, getScanSettings } from "@/lib/db/settings";
import { ConflictError, NotFoundError, ValidationError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { buildCoveragePlan } from "@/lib/providers/places/coverage";
import { getProviderStatus } from "@/lib/providers/registry";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { isCancellable } from "@/lib/workflows/scan-state";
import { scanWorkflow } from "@/lib/workflows/scan/scan.workflow";
import type { GeoPoint, GeoPolygon } from "@/types/common";
import type { ScanRow } from "@/types/db";

import type { CreateScanInput, EstimateScanInput } from "./schemas";

export interface ScanEstimate extends ScanCreditEstimate {
  cells: number;
  areaKm2: number | null;
  coverageNotes: string[];
  estimatedBusinesses: number;
  balance: { available: number; reserved: number; unlimited: boolean };
  sufficient: boolean;
}

/**
 * Plans the area and prices the scan without creating anything. The wizard shows
 * this before the user commits; `createScan` recomputes it server-side so a
 * client cannot understate the cost.
 */
export async function estimateScan(ctx: WorkspaceContext, input: EstimateScanInput): Promise<ScanEstimate> {
  const settings = await getScanSettings();
  const plan = planFor(input, settings.default_cell_radius_m, Math.max(1, Math.floor(settings.max_businesses_per_scan / 4)));

  const maxBusinesses = Math.min(input.maxBusinesses, settings.max_businesses_per_scan);
  const estimatedBusinesses = estimateBusinessCount({
    cells: plan.cells.length,
    categories: input.categoryIds.length,
    maxBusinesses,
  });

  const pricing = await loadPricingTable(ctx.supabase);
  const flags = await getFeatureFlags();
  const includeBenchmark = input.filters.includeBenchmark && flags.competitor_benchmark;
  const estimate = estimateScanCredits({ estimatedBusinesses, depth: input.auditDepth, includeBenchmark }, pricing);

  const { data: account } = await ctx.supabase
    .from("credit_accounts")
    .select("balance, reserved, unlimited")
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<{ balance: number; reserved: number; unlimited: boolean }>();

  const available = account?.balance ?? 0;
  // An unlimited account is never billed, so the estimate is informational only
  // and the balance must not block the scan.
  const unlimited = account?.unlimited === true;
  return {
    ...estimate,
    cells: plan.cells.length,
    areaKm2: plan.areaKm2,
    coverageNotes: plan.notes,
    estimatedBusinesses,
    balance: { available, reserved: account?.reserved ?? 0, unlimited },
    sufficient: unlimited || available >= estimate.total,
  };
}

export interface CreateScanResult {
  scan: ScanRow;
  estimate: ScanEstimate;
  workflowRunId: string | null;
}

/**
 * Creates the scan, its category/service selections, and starts the durable
 * workflow. Credits are reserved inside the workflow (idempotently), so a failed
 * start never leaves a dangling reservation.
 */
export async function createScan(ctx: WorkspaceContext, input: CreateScanInput): Promise<CreateScanResult> {
  const settings = await getScanSettings();
  const estimate = await estimateScan(ctx, input);
  if (!estimate.sufficient) {
    throw new ValidationError("Not enough credits for this scan", {
      details: { required: estimate.total, available: estimate.balance.available },
    });
  }

  await assertSelectionsExist(ctx, input);

  const maxBusinesses = Math.min(input.maxBusinesses, settings.max_businesses_per_scan);
  const providers = getProviderStatus();
  const name = input.name?.trim() || defaultScanName(input);

  const { data: scan, error } = await ctx.supabase
    .from("scans")
    .insert({
      workspace_id: ctx.workspace.id,
      created_by: ctx.user.id,
      name,
      status: "created",
      location_method: input.locationMethod,
      place_label: input.placeLabel ?? null,
      center_lat: input.center?.lat ?? null,
      center_lng: input.center?.lng ?? null,
      radius_m: input.radiusM ?? null,
      polygon: input.polygon ?? null,
      area_km2: estimate.areaKm2,
      audit_depth: input.auditDepth,
      filters: input.filters,
      max_businesses: maxBusinesses,
      estimated_businesses: estimate.estimatedBusinesses,
      estimated_credits: estimate.total,
      is_demo: providers.places.demo,
      coverage_metadata: { cells: estimate.cells, notes: estimate.coverageNotes },
    })
    .select("*")
    .single<ScanRow>();

  if (error || !scan) throw toAppError(error ?? new Error("Scan could not be created"));

  const [{ error: categoryError }, { error: serviceError }] = await Promise.all([
    ctx.supabase.from("scan_categories").insert(input.categoryIds.map((categoryId) => ({ scan_id: scan.id, category_id: categoryId }))),
    ctx.supabase.from("scan_services").insert(input.serviceIds.map((serviceId) => ({ scan_id: scan.id, service_id: serviceId }))),
  ]);
  if (categoryError || serviceError) throw toAppError(categoryError ?? serviceError);

  await recordActivity(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    scanId: scan.id,
    actorId: ctx.user.id,
    type: "scan_started",
    title: name,
    metadata: { depth: input.auditDepth, categories: input.categoryIds.length, estimatedCredits: estimate.total },
  });

  const workflowRunId = await startScanWorkflow(scan.id);
  if (workflowRunId) {
    await ctx.supabase.from("scans").update({ workflow_run_id: workflowRunId, status: "queued", started_at: new Date().toISOString() }).eq("id", scan.id);
  }

  return { scan: { ...scan, workflow_run_id: workflowRunId }, estimate, workflowRunId };
}

/**
 * Starts the durable run. A failure here leaves the scan in `created` so it can
 * be retried; it never throws into the request path.
 */
async function startScanWorkflow(scanId: string): Promise<string | null> {
  try {
    const run = await start(scanWorkflow, [scanId]);
    return run.runId;
  } catch (err) {
    logger.error("scan_workflow_start_failed", { scanId, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/** Cancels a running scan and asks the workflow runtime to stop the run. */
export async function cancelScan(ctx: WorkspaceContext, scanId: string): Promise<ScanRow> {
  const scan = await requireScan(ctx, scanId);
  if (!isCancellable(scan.status)) throw new ConflictError("This scan can no longer be cancelled", { details: { status: scan.status } });

  const { data: updated, error } = await ctx.supabase
    .from("scans")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), completed_at: new Date().toISOString() })
    .eq("id", scanId)
    .select("*")
    .single<ScanRow>();
  if (error || !updated) throw toAppError(error ?? new Error("Scan could not be cancelled"));

  if (scan.workflow_run_id) {
    try {
      await getRun(scan.workflow_run_id).cancel();
    } catch (err) {
      // The run may have already finished; the status change is what matters.
      logger.warn("scan_workflow_cancel_failed", { scanId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Release the reservation now rather than waiting for the workflow to notice
  // the cancellation. If the release cannot be completed, surface the failure
  // instead of silently leaving credits stranded; the user can retry cancellation
  // after the provider/database issue is resolved.
  if (isAdminClientConfigured()) {
    try {
      const release = await getCreditService().releaseReservation({
        workspaceId: ctx.workspace.id,
        referenceType: REFERENCE_TYPES.scan,
        referenceId: scanId,
        idempotencyKey: creditKeys.scanRelease(scanId),
        actorId: ctx.user.id,
      });
      if (release.refunded > 0) {
        await ctx.supabase.from("scans").update({ refunded_credits: release.refunded }).eq("id", scanId);
      }
    } catch (err) {
      logger.error("scan_reservation_release_failed", { scanId, error: err instanceof Error ? err.message : String(err) });
      throw toAppError(err, "Could not release reserved credits");
    }
  }

  await recordActivity(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    scanId,
    actorId: ctx.user.id,
    type: "scan_cancelled",
    title: scan.name,
  });

  return updated;
}

/** Restarts a scan that ended in a non-successful state. */
export async function retryScan(ctx: WorkspaceContext, scanId: string): Promise<ScanRow> {
  const scan = await requireScan(ctx, scanId);
  if (scan.status !== "failed" && scan.status !== "cancelled" && scan.status !== "partially_completed") {
    throw new ConflictError("Only failed, cancelled or partially completed scans can be retried", { details: { status: scan.status } });
  }

  const { data: updated, error } = await ctx.supabase
    .from("scans")
    .update({ status: "created", error_code: null, error_message: null, completed_at: null, cancelled_at: null })
    .eq("id", scanId)
    .select("*")
    .single<ScanRow>();
  if (error || !updated) throw toAppError(error ?? new Error("Scan could not be retried"));

  const workflowRunId = await startScanWorkflow(scanId);
  if (workflowRunId) {
    await ctx.supabase.from("scans").update({ workflow_run_id: workflowRunId, status: "queued", started_at: new Date().toISOString() }).eq("id", scanId);
  }
  return { ...updated, workflow_run_id: workflowRunId };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function planFor(input: EstimateScanInput, cellRadiusM: number, maxCells: number) {
  return buildCoveragePlan({
    method: input.locationMethod,
    center: (input.center ?? undefined) as GeoPoint | undefined,
    radiusM: input.radiusM ?? undefined,
    polygon: (input.polygon ?? undefined) as GeoPolygon | undefined,
    cellRadiusM,
    maxCells,
  });
}

function defaultScanName(input: EstimateScanInput): string {
  const where = input.placeLabel?.trim();
  if (where) return where;
  if (input.locationMethod === "polygon") return "Drawn area";
  if (input.center) return `${input.center.lat.toFixed(3)}, ${input.center.lng.toFixed(3)}`;
  return "New scan";
}

/** Rejects ids the workspace is not allowed to use before anything is written. */
async function assertSelectionsExist(ctx: WorkspaceContext, input: CreateScanInput): Promise<void> {
  const [{ data: categories }, { data: services }] = await Promise.all([
    ctx.supabase.from("categories").select("id").in("id", input.categoryIds).eq("active", true).returns<{ id: string }[]>(),
    ctx.supabase.from("services").select("id").in("id", input.serviceIds).eq("active", true).returns<{ id: string }[]>(),
  ]);
  if ((categories?.length ?? 0) !== input.categoryIds.length) throw new ValidationError("One or more categories are not available");
  if ((services?.length ?? 0) !== input.serviceIds.length) throw new ValidationError("One or more services are not available");
}

async function requireScan(ctx: WorkspaceContext, scanId: string): Promise<ScanRow> {
  const { data, error } = await ctx.supabase.from("scans").select("*").eq("id", scanId).maybeSingle<ScanRow>();
  if (error) throw toAppError(error);
  if (!data) throw new NotFoundError("Scan not found");
  return data;
}

export { createAdminClient };
