import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logging";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/common";

/**
 * Helpers shared by the scan workflow steps.
 *
 * Steps run without a user session, so they use the service-role client and
 * always derive `workspace_id` from the `scans` row they were started for —
 * never from a step argument.
 */

export function adminClient(): SupabaseClient {
  return createAdminClient();
}

export const stepLogger = logger.child({ component: "scan_workflow" });

/** Appends an entry to scan_job_events. Best effort: never fails the step. */
export async function appendScanEvent(
  client: SupabaseClient,
  input: {
    scanId: string;
    workspaceId: string;
    eventType: string;
    level?: "debug" | "info" | "warn" | "error";
    message?: string | null;
    scanJobId?: string | null;
    metadata?: Record<string, Json>;
  },
): Promise<void> {
  const { error } = await client.from("scan_job_events").insert({
    scan_id: input.scanId,
    workspace_id: input.workspaceId,
    scan_job_id: input.scanJobId ?? null,
    event_type: input.eventType,
    level: input.level ?? "info",
    message: input.message ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) stepLogger.warn("scan_event_insert_failed", { scanId: input.scanId, eventType: input.eventType, error: error.message });
}

/**
 * Claims a unit of work for a scan. Returns false when the job already exists
 * and is finished, which makes every step safe to replay after a crash.
 */
export async function claimScanJob(
  client: SupabaseClient,
  input: { scanId: string; workspaceId: string; jobType: "discovery" | "dedupe" | "audit" | "scoring" | "finalize"; idempotencyKey: string; businessId?: string | null },
): Promise<{ claimed: boolean; jobId: string | null; attempt: number }> {
  const { data: existing } = await client
    .from("scan_jobs")
    .select("id, status, attempt")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle<{ id: string; status: string; attempt: number }>();

  if (existing) {
    if (existing.status === "completed" || existing.status === "skipped" || existing.status === "cancelled") {
      return { claimed: false, jobId: existing.id, attempt: existing.attempt };
    }
    const attempt = existing.attempt + 1;
    await client.from("scan_jobs").update({ status: "running", attempt, started_at: new Date().toISOString() }).eq("id", existing.id);
    return { claimed: true, jobId: existing.id, attempt };
  }

  const { data: inserted, error } = await client
    .from("scan_jobs")
    .insert({
      scan_id: input.scanId,
      workspace_id: input.workspaceId,
      business_id: input.businessId ?? null,
      job_type: input.jobType,
      status: "running",
      attempt: 1,
      idempotency_key: input.idempotencyKey,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    // A concurrent replay inserted the same key; treat it as already claimed.
    if (error.code === "23505") return { claimed: false, jobId: null, attempt: 0 };
    throw error;
  }
  return { claimed: true, jobId: inserted?.id ?? null, attempt: 1 };
}

export async function finishScanJob(
  client: SupabaseClient,
  jobId: string | null,
  status: "completed" | "failed" | "skipped" | "cancelled",
  error?: { code?: string | null; message?: string | null },
): Promise<void> {
  if (!jobId) return;
  await client
    .from("scan_jobs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      error_code: error?.code ?? null,
      error_message: error?.message ? error.message.slice(0, 500) : null,
    })
    .eq("id", jobId);
}

/** Atomically bumps the scan counters through the SQL helper. */
export async function bumpScanCounters(
  client: SupabaseClient,
  scanId: string,
  counters: { discovered?: number; deduplicated?: number; audited?: number; scored?: number; failed?: number; consumed?: number },
): Promise<void> {
  const { error } = await client.rpc("increment_scan_counters", {
    p_scan: scanId,
    p_discovered: counters.discovered ?? 0,
    p_deduplicated: counters.deduplicated ?? 0,
    p_audited: counters.audited ?? 0,
    p_scored: counters.scored ?? 0,
    p_failed: counters.failed ?? 0,
    p_consumed: counters.consumed ?? 0,
  });
  if (error) stepLogger.warn("scan_counter_bump_failed", { scanId, error: error.message });
}

/** Reads the scan's current status. Steps use it to stop early once cancelled. */
export async function readScanStatus(client: SupabaseClient, scanId: string): Promise<string | null> {
  const { data } = await client.from("scans").select("status").eq("id", scanId).maybeSingle<{ status: string }>();
  return data?.status ?? null;
}

export async function isScanCancelled(client: SupabaseClient, scanId: string): Promise<boolean> {
  const status = await readScanStatus(client, scanId);
  return status === "cancelled" || status === "failed";
}

/** Splits work into fixed-size batches. Pure and deterministic: safe in a workflow body. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const limit = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += limit) out.push(items.slice(i, i + limit));
  return out;
}

export function errorCodeOf(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "internal_error";
}

export function errorMessageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
