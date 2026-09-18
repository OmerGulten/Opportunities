import { auditAndScoreBusiness } from "./audit";

/**
 * Re-audits a single business on demand.
 *
 * It reuses the scan pipeline's audit step, so a manual refresh produces exactly
 * the same audits, signals and scores a scan would. `runKey` gives the run its
 * own idempotency key, so the refresh is neither skipped as already-done nor
 * confused with the original scan's job, and is billed as its own audit.
 */
export async function refreshBusinessWorkflow(scanId: string, businessId: string, runKey: string) {
  "use workflow";

  const result = await auditAndScoreBusiness(scanId, businessId, runKey);
  return { scanId, businessId, runKey, status: result.status, score: result.score };
}
