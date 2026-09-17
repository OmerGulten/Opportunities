import type { PerformanceAuditSummary } from "@/types/audits";

export type PerformanceStrategy = "mobile" | "desktop";

export interface PerformanceAuditOptions {
  strategies?: PerformanceStrategy[]; // default ["mobile"]
  /** Pre-fetched HTML for heuristic analysis (avoids a second fetch). */
  html?: string;
  responseTimeMs?: number;
  context?: { workspaceId?: string; scanId?: string; businessId?: string };
}

export interface PerformanceProvider {
  readonly name: "pagespeed" | "heuristic";
  readonly isHeuristic: boolean;
  audit(url: string, options?: PerformanceAuditOptions): Promise<PerformanceAuditSummary>;
}
