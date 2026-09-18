import { FatalError } from "workflow";

import { getCreditService, loadPricingTable } from "@/lib/credits/server";
import { creditKeys, REFERENCE_TYPES } from "@/lib/credits/keys";
import { estimateScanCredits, type PricingTable } from "@/lib/credits/pricing";
import { getFeatureFlags, getScanSettings } from "@/lib/db/settings";
import { InsufficientCreditsError } from "@/lib/errors";
import { getProviderStatus } from "@/lib/providers/registry";
import { assertScanTransition } from "@/lib/workflows/scan-state";
import type { AuditDepth, Locale, ScanStatus } from "@/types/common";
import type { ScanRow } from "@/types/db";

import { adminClient, appendScanEvent, bumpScanCounters, stepLogger } from "./shared";

/**
 * Serializable scan context handed to the workflow body. Everything the
 * orchestration needs to decide control flow lives here; steps re-read the
 * database for anything larger.
 */
export interface ScanContext {
  proceed: boolean;
  status: ScanStatus;
  scanId: string;
  workspaceId: string;
  locale: Locale;
  depth: AuditDepth;
  maxBusinesses: number;
  includeBenchmark: boolean;
  discoveryConcurrency: number;
  auditConcurrency: number;
  categoryIds: string[];
  serviceIds: string[];
  isDemo: boolean;
  features: { instagramDiscovery: boolean; performance: boolean; competitorBenchmark: boolean };
}

interface ScanConfigRow extends ScanRow {
  scan_categories: { category_id: string }[] | null;
  scan_services: { service_id: string }[] | null;
  workspaces: { default_locale: Locale } | null;
}

/**
 * Loads the scan and everything needed to run it, and moves it into `queued`.
 * Returns `proceed: false` when the scan is already terminal so a replayed
 * workflow exits cleanly instead of running the work twice.
 */
export async function loadScanContext(scanId: string): Promise<ScanContext> {
  "use step";

  const client = adminClient();
  const { data, error } = await client
    .from("scans")
    .select("*, scan_categories(category_id), scan_services(service_id), workspaces(default_locale)")
    .eq("id", scanId)
    .maybeSingle<ScanConfigRow>();

  if (error) throw new FatalError(`Could not load scan ${scanId}: ${error.message}`);
  if (!data) throw new FatalError(`Scan ${scanId} does not exist`);

  const terminal: ScanStatus[] = ["completed", "partially_completed", "failed", "cancelled"];
  if (terminal.includes(data.status)) {
    stepLogger.info("scan_already_terminal", { scanId, status: data.status });
    return emptyContext(data, data.status);
  }

  const [settings, flags] = await Promise.all([getScanSettings(), getFeatureFlags()]);
  const providers = getProviderStatus();
  const filters = (data.filters ?? {}) as { includeBenchmark?: boolean };
  const includeBenchmark = filters.includeBenchmark === true && flags.competitor_benchmark;

  if (data.status === "created") {
    assertScanTransition(data.status, "queued");
    await client.from("scans").update({ status: "queued", started_at: data.started_at ?? new Date().toISOString() }).eq("id", scanId);
  }

  await appendScanEvent(client, {
    scanId,
    workspaceId: data.workspace_id,
    eventType: "scan_queued",
    message: "Scan accepted by the workflow",
    metadata: { depth: data.audit_depth, provider: providers.places.provider, demo: providers.anyDemo },
  });

  return {
    proceed: true,
    status: "queued",
    scanId,
    workspaceId: data.workspace_id,
    locale: data.workspaces?.default_locale ?? "tr",
    depth: data.audit_depth,
    maxBusinesses: data.max_businesses,
    includeBenchmark,
    discoveryConcurrency: Math.max(1, Math.min(5, settings.audit_concurrency)),
    auditConcurrency: Math.max(1, settings.audit_concurrency),
    categoryIds: (data.scan_categories ?? []).map((row) => row.category_id),
    serviceIds: (data.scan_services ?? []).map((row) => row.service_id),
    isDemo: providers.anyDemo,
    features: {
      instagramDiscovery: flags.instagram_discovery,
      performance: flags.pagespeed,
      competitorBenchmark: flags.competitor_benchmark,
    },
  };
}

function emptyContext(scan: ScanRow, status: ScanStatus): ScanContext {
  return {
    proceed: false,
    status,
    scanId: scan.id,
    workspaceId: scan.workspace_id,
    locale: "tr",
    depth: scan.audit_depth,
    maxBusinesses: scan.max_businesses,
    includeBenchmark: false,
    discoveryConcurrency: 1,
    auditConcurrency: 1,
    categoryIds: [],
    serviceIds: [],
    isDemo: false,
    features: { instagramDiscovery: false, performance: false, competitorBenchmark: false },
  };
}

export interface ReservationResult {
  reserved: number;
  alreadyReserved: boolean;
}

/**
 * Reserves the estimated cost up front so a scan cannot outspend the balance.
 * Idempotent through `creditKeys.scanReserve`; the unused remainder is refunded
 * by `finalizeScan`.
 */
export async function reserveScanCredits(scanId: string): Promise<ReservationResult> {
  "use step";

  const client = adminClient();
  const { data: scan, error } = await client
    .from("scans")
    .select("id, workspace_id, estimated_credits, reserved_credits, status")
    .eq("id", scanId)
    .maybeSingle<Pick<ScanRow, "id" | "workspace_id" | "estimated_credits" | "reserved_credits" | "status">>();

  if (error || !scan) throw new FatalError(`Scan ${scanId} could not be loaded for credit reservation`);
  if (scan.reserved_credits > 0) return { reserved: scan.reserved_credits, alreadyReserved: true };

  const amount = Math.max(0, scan.estimated_credits);
  if (amount === 0) return { reserved: 0, alreadyReserved: false };

  try {
    await getCreditService().reserve({
      workspaceId: scan.workspace_id,
      amount,
      referenceType: REFERENCE_TYPES.scan,
      referenceId: scanId,
      idempotencyKey: creditKeys.scanReserve(scanId),
      metadata: { scanId },
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      await client
        .from("scans")
        .update({ status: "failed", error_code: "insufficient_credits", error_message: "Not enough credits to start this scan", completed_at: new Date().toISOString() })
        .eq("id", scanId);
      await appendScanEvent(client, { scanId, workspaceId: scan.workspace_id, eventType: "scan_failed", level: "error", message: "Insufficient credits" });
      throw new FatalError("Insufficient credits to start the scan");
    }
    throw err;
  }

  await client.from("scans").update({ reserved_credits: amount }).eq("id", scanId);
  await appendScanEvent(client, { scanId, workspaceId: scan.workspace_id, eventType: "credits_reserved", metadata: { amount } });
  return { reserved: amount, alreadyReserved: false };
}

/** Recomputes the credit estimate for a scan. Used by the API before the scan starts. */
export async function computeScanEstimate(input: {
  cells: number;
  categories: number;
  maxBusinesses: number;
  depth: AuditDepth;
  includeBenchmark: boolean;
  pricing: PricingTable;
  estimatedBusinesses: number;
}) {
  return estimateScanCredits(
    { estimatedBusinesses: input.estimatedBusinesses, depth: input.depth, includeBenchmark: input.includeBenchmark },
    input.pricing,
  );
}

export { loadPricingTable, bumpScanCounters };
