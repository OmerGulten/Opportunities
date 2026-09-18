import { auditAndScoreBusiness, listPendingBusinesses } from "./audit";
import { loadScanContext, reserveScanCredits } from "./context";
import { dedupeScanBusinesses, discoverCell, planCoverage } from "./discovery";
import { failScan, finalizeScan, setScanStatus } from "./finalize";

/**
 * Durable scan orchestration (Vercel Workflow DevKit).
 *
 * This function is the only "use workflow" body in the scan pipeline: it is
 * sandboxed, deterministic and does no I/O of its own. Every side effect lives
 * in a "use step" function, so a crash resumes from the last completed step
 * rather than re-running the whole scan.
 *
 * Lifecycle: queued -> discovering -> deduplicating -> auditing -> scoring ->
 * completed | partially_completed | failed | cancelled.
 */
export async function scanWorkflow(scanId: string) {
  "use workflow";

  const context = await loadScanContext(scanId);
  // A replayed or already finished scan exits without repeating the work.
  if (!context.proceed) {
    return { scanId, status: context.status, skipped: true };
  }

  try {
    await reserveScanCredits(scanId);

    // ---- discovery -----------------------------------------------------
    const coverage = await planCoverage(scanId);
    for (const batch of batches(coverage.units, context.discoveryConcurrency)) {
      // One failing cell must not end the sweep, so failures are swallowed here;
      // the step itself has already recorded them on the target and the event log.
      await Promise.all(batch.map((unit) => discoverCell(scanId, unit.cellIndex, unit.categoryId).catch(() => null)));
    }

    // ---- deduplication -------------------------------------------------
    await dedupeScanBusinesses(scanId);

    // ---- audit + scoring ----------------------------------------------
    const auditing = await setScanStatus(scanId, "auditing");
    if (isStopped(auditing.status)) return await finalizeScan(scanId);

    const pending = await listPendingBusinesses(scanId);
    for (const batch of batches(pending, context.auditConcurrency)) {
      await Promise.all(batch.map((businessId) => auditAndScoreBusiness(scanId, businessId).catch(() => null)));
    }

    const scoring = await setScanStatus(scanId, "scoring");
    if (isStopped(scoring.status)) return await finalizeScan(scanId);

    return await finalizeScan(scanId);
  } catch (error) {
    // Orchestration-level failure (a fatal step). Record it, release the
    // reservation and end in a terminal state rather than hanging.
    await failScan(scanId, "workflow_failed", error instanceof Error ? error.message : String(error));
    return await finalizeScan(scanId);
  }
}

/** Fixed-size batches. Pure and deterministic, so it is safe in a workflow body. */
function batches<T>(items: readonly T[], size: number): T[][] {
  const limit = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += limit) out.push(items.slice(i, i + limit));
  return out;
}

function isStopped(status: string): boolean {
  return status === "cancelled" || status === "failed";
}
