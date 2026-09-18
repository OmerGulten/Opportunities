/**
 * Idempotency keys and reference types for ledger entries. Keys are stable,
 * human-readable and unique per logical operation so that workflow step retries
 * replay instead of double-charging. Keep in sync with docs/workflows.md and the
 * monthly grant written by `create_workspace_with_defaults` in the schema
 * (`grant:<workspace>:<YYYY-MM>`).
 */

export const REFERENCE_TYPES = {
  scan: "scan",
  message: "message",
  report: "report",
  plan: "plan",
  purchase: "purchase",
  admin: "admin",
} as const;

export type CreditReferenceType = (typeof REFERENCE_TYPES)[keyof typeof REFERENCE_TYPES];

export const creditKeys = {
  /** Reservation of the estimated scan cost at scan start. */
  scanReserve: (scanId: string): string => `scan:${scanId}:reserve`,
  /** Per-business consumption inside a scan. */
  scanBusiness: (scanId: string, businessId: string): string => `scan:${scanId}:business:${businessId}`,
  /** Refund of the unused reservation when the scan finishes, fails or is cancelled. */
  scanRelease: (scanId: string): string => `scan:${scanId}:release`,
  /** One AI outreach generation. */
  aiMessage: (generationId: string): string => `message:${generationId}`,
  /** One public report creation. */
  report: (reportId: string): string => `report:${reportId}`,
  /** Competitor benchmark for a business within a scan (or another run identifier). */
  benchmark: (businessId: string, scanId: string): string => `benchmark:${businessId}:${scanId}`,
  /** Plan grant for a billing period; `period` is `YYYY-MM` (see `formatGrantPeriod`). */
  monthlyGrant: (workspaceId: string, period: string): string => `grant:${workspaceId}:${period}`,
  /** Credit pack purchase, keyed by the billing provider's payment id. */
  purchase: (paymentId: string): string => `purchase:${paymentId}`,
  /** Manual platform-admin adjustment, keyed by a caller-generated id. */
  adminAdjustment: (id: string): string => `admin:${id}`,
} as const;

/** `YYYY-MM` in UTC, matching `to_char(now(), 'YYYY-MM')` used by the schema's initial grant. */
export function formatGrantPeriod(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
