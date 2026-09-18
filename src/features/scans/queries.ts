import "server-only";

import type { WorkspaceContext } from "@/lib/auth/context";
import { toAppError } from "@/lib/errors";
import { isActiveScanStatus, isTerminalScanStatus, scanProgressPercent } from "@/lib/workflows/scan-state";
import type { ScanStatus } from "@/types/common";
import type { ScanJobEventRow, ScanRow, ScanTargetRow } from "@/types/db";

export interface ScanProgress {
  percent: number;
  active: boolean;
  terminal: boolean;
  remaining: number;
}

export interface ScanListItem extends ScanRow {
  progress: ScanProgress;
  categoryNames: string[];
}

/** Derived progress for the UI. Counters come from the workflow steps. */
export function progressOf(scan: ScanRow): ScanProgress {
  const processed = scan.scored_count + scan.failed_count;
  return {
    percent: scanProgressPercent(scan),
    active: isActiveScanStatus(scan.status),
    terminal: isTerminalScanStatus(scan.status),
    remaining: Math.max(0, scan.discovered_count - processed),
  };
}

export async function listScans(
  ctx: WorkspaceContext,
  opts: { status?: ScanStatus | "active" | "terminal"; limit?: number; offset?: number } = {},
): Promise<{ items: ScanListItem[]; total: number }> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  let query = ctx.supabase
    .from("scans")
    .select("*, scan_categories(categories(name_tr, name_en))", { count: "exact" })
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status === "active") query = query.in("status", ["created", "queued", "discovering", "deduplicating", "enriching", "auditing", "scoring"]);
  else if (opts.status === "terminal") query = query.in("status", ["completed", "partially_completed", "failed", "cancelled"]);
  else if (opts.status) query = query.eq("status", opts.status);

  const { data, error, count } = await query.returns<Array<ScanRow & { scan_categories: Array<{ categories: { name_tr: string; name_en: string } | null }> | null }>>();
  if (error) throw toAppError(error);

  const items = (data ?? []).map((row) => {
    const { scan_categories, ...scan } = row;
    return {
      ...scan,
      progress: progressOf(scan),
      categoryNames: (scan_categories ?? [])
        .map((entry) => (ctx.locale === "en" ? entry.categories?.name_en : entry.categories?.name_tr))
        .filter((name): name is string => Boolean(name)),
    };
  });

  return { items, total: count ?? items.length };
}

export interface ScanDetail extends ScanListItem {
  targets: ScanTargetRow[];
  events: ScanJobEventRow[];
  serviceIds: string[];
  categoryIds: string[];
  counts: { discovered: number; audited: number; scored: number; failed: number; opportunities: number };
}

export async function getScan(ctx: WorkspaceContext, scanId: string): Promise<ScanDetail | null> {
  const { data, error } = await ctx.supabase
    .from("scans")
    .select("*, scan_categories(category_id, categories(name_tr, name_en)), scan_services(service_id)")
    .eq("id", scanId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<
      ScanRow & {
        scan_categories: Array<{ category_id: string; categories: { name_tr: string; name_en: string } | null }> | null;
        scan_services: Array<{ service_id: string }> | null;
      }
    >();
  if (error) throw toAppError(error);
  if (!data) return null;

  const { scan_categories, scan_services, ...scan } = data;

  const [{ data: targets }, { data: events }, { count: opportunityCount }] = await Promise.all([
    ctx.supabase.from("scan_targets").select("*").eq("scan_id", scanId).order("cell_index").returns<ScanTargetRow[]>(),
    ctx.supabase.from("scan_job_events").select("*").eq("scan_id", scanId).order("created_at", { ascending: false }).limit(50).returns<ScanJobEventRow[]>(),
    ctx.supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("scan_id", scanId),
  ]);

  return {
    ...scan,
    progress: progressOf(scan),
    categoryNames: (scan_categories ?? [])
      .map((entry) => (ctx.locale === "en" ? entry.categories?.name_en : entry.categories?.name_tr))
      .filter((name): name is string => Boolean(name)),
    categoryIds: (scan_categories ?? []).map((entry) => entry.category_id),
    serviceIds: (scan_services ?? []).map((entry) => entry.service_id),
    targets: targets ?? [],
    events: events ?? [],
    counts: {
      discovered: scan.discovered_count,
      audited: scan.audited_count,
      scored: scan.scored_count,
      failed: scan.failed_count,
      opportunities: opportunityCount ?? 0,
    },
  };
}

/** Lightweight status payload for the progress poller. */
export async function getScanStatus(ctx: WorkspaceContext, scanId: string) {
  const { data, error } = await ctx.supabase
    .from("scans")
    .select("id, status, discovered_count, audited_count, scored_count, failed_count, total_targets, consumed_credits, reserved_credits, refunded_credits, error_code, completed_at")
    .eq("id", scanId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<ScanRow>();
  if (error) throw toAppError(error);
  if (!data) return null;
  return { ...data, progress: progressOf(data) };
}
