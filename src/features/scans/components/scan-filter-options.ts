/**
 * Status buckets offered by the scan list filter. Kept out of the client module
 * so the server page can validate the `status` search param with the same list.
 * `active` and `terminal` are the groupings `listScans` understands.
 */
export const SCAN_STATUS_FILTERS = [
  "all",
  "active",
  "terminal",
  "completed",
  "partially_completed",
  "failed",
  "cancelled",
] as const;

export type ScanStatusFilter = (typeof SCAN_STATUS_FILTERS)[number];

export function isScanStatusFilter(value: unknown): value is ScanStatusFilter {
  return typeof value === "string" && (SCAN_STATUS_FILTERS as readonly string[]).includes(value);
}
