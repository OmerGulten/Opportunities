import { FatalError } from "workflow";

import { recordActivity } from "@/lib/activity";
import { creditKeys, REFERENCE_TYPES } from "@/lib/credits/keys";
import { getCreditService } from "@/lib/credits/server";
import { canTransition, finalStatusFor } from "@/lib/workflows/scan-state";
import type { ScanStatus } from "@/types/common";
import type { ScanRow } from "@/types/db";

import { adminClient, appendScanEvent, stepLogger } from "./shared";

/**
 * Moves the scan to a new lifecycle status. Invalid transitions are ignored
 * rather than fatal: a cancelled scan must stay cancelled even if a step that
 * was already in flight finishes afterwards.
 */
export async function setScanStatus(scanId: string, status: ScanStatus): Promise<{ status: ScanStatus; changed: boolean }> {
  "use step";

  const client = adminClient();
  const { data } = await client.from("scans").select("id, status, workspace_id").eq("id", scanId).maybeSingle<Pick<ScanRow, "id" | "status" | "workspace_id">>();
  if (!data) throw new FatalError(`Scan ${scanId} does not exist`);
  if (data.status === status) return { status, changed: false };
  if (!canTransition(data.status, status)) {
    stepLogger.info("scan_transition_skipped", { scanId, from: data.status, to: status });
    return { status: data.status, changed: false };
  }

  await client.from("scans").update({ status }).eq("id", scanId);
  await appendScanEvent(client, { scanId, workspaceId: data.workspace_id, eventType: `scan_${status}`, metadata: { from: data.status } });
  return { status, changed: true };
}

export interface FinalizeResult {
  status: ScanStatus;
  discovered: number;
  scored: number;
  failed: number;
  consumedCredits: number;
  refundedCredits: number;
}

/**
 * Closes the scan: decides the final status from the counters, returns the
 * unused part of the reservation to the workspace balance and records the
 * activity entry. Idempotent — the refund uses a fixed idempotency key and the
 * status is only written once.
 */
export async function finalizeScan(scanId: string): Promise<FinalizeResult> {
  "use step";

  const client = adminClient();
  const { data: scan, error } = await client.from("scans").select("*").eq("id", scanId).maybeSingle<ScanRow>();
  if (error || !scan) throw new FatalError(`Scan ${scanId} could not be loaded for finalization`);

  const discoveryFailed = scan.discovered_count === 0 && scan.failed_count > 0;
  const alreadyTerminal = scan.status === "cancelled" || scan.status === "failed" || scan.status === "completed" || scan.status === "partially_completed";
  const finalStatus: ScanStatus = alreadyTerminal
    ? scan.status
    : finalStatusFor({ discovered: scan.discovered_count, failed: scan.failed_count, scored: scan.scored_count }, discoveryFailed);

  // Always release the remainder, including for cancelled and failed scans.
  let refunded = scan.refunded_credits;
  try {
    const release = await getCreditService().releaseReservation({
      workspaceId: scan.workspace_id,
      referenceType: REFERENCE_TYPES.scan,
      referenceId: scanId,
      idempotencyKey: creditKeys.scanRelease(scanId),
    });
    if (release.refunded > 0) refunded = scan.refunded_credits + release.refunded;
  } catch (err) {
    // A failed refund must not strand the scan in a running state; it is logged
    // and reconciled by the reservation row, which still records the remainder.
    stepLogger.error("scan_reservation_release_failed", { scanId, error: err instanceof Error ? err.message : String(err) });
    await appendScanEvent(client, { scanId, workspaceId: scan.workspace_id, eventType: "credit_release_failed", level: "error" });
  }

  await client
    .from("scans")
    .update({
      status: finalStatus,
      refunded_credits: refunded,
      completed_at: scan.completed_at ?? new Date().toISOString(),
    })
    .eq("id", scanId);

  await appendScanEvent(client, {
    scanId,
    workspaceId: scan.workspace_id,
    eventType: "scan_finalized",
    message: `Scan finished with status ${finalStatus}`,
    metadata: {
      status: finalStatus,
      discovered: scan.discovered_count,
      scored: scan.scored_count,
      failed: scan.failed_count,
      refunded: refunded - scan.refunded_credits,
    },
  });

  await recordActivity(client, {
    workspaceId: scan.workspace_id,
    scanId,
    type: finalStatus === "cancelled" ? "scan_cancelled" : finalStatus === "failed" ? "scan_failed" : "scan_completed",
    title: scan.name,
    metadata: {
      status: finalStatus,
      discovered: scan.discovered_count,
      scored: scan.scored_count,
      failed: scan.failed_count,
    },
  });

  return {
    status: finalStatus,
    discovered: scan.discovered_count,
    scored: scan.scored_count,
    failed: scan.failed_count,
    consumedCredits: scan.consumed_credits,
    refundedCredits: refunded,
  };
}

/** Marks the scan failed with a typed reason. Used when orchestration itself breaks. */
export async function failScan(scanId: string, code: string, message: string): Promise<void> {
  "use step";

  const client = adminClient();
  const { data: scan } = await client.from("scans").select("id, workspace_id, status").eq("id", scanId).maybeSingle<Pick<ScanRow, "id" | "workspace_id" | "status">>();
  if (!scan) return;
  if (scan.status === "cancelled") return;

  await client
    .from("scans")
    .update({ status: "failed", error_code: code, error_message: message.slice(0, 500), completed_at: new Date().toISOString() })
    .eq("id", scanId);
  await appendScanEvent(client, { scanId, workspaceId: scan.workspace_id, eventType: "scan_failed", level: "error", message: message.slice(0, 300), metadata: { code } });
}
