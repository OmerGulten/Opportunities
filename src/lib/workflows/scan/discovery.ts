import type { SupabaseClient } from "@supabase/supabase-js";
import { FatalError, RetryableError } from "workflow";

import { dedupePlaces } from "@/features/businesses/dedupe";
import { getScanSettings } from "@/lib/db/settings";
import { AppError } from "@/lib/errors";
import { getPlaceProvider } from "@/lib/providers/registry";
import { buildCoveragePlan, filterPlacesToPolygon, filterPlacesToRadius } from "@/lib/providers/places/coverage";
import { getPolicy, snapshotExpiryDate } from "@/lib/providers/policy";
import type { GeoPoint, GeoPolygon } from "@/types/common";
import type { CategoryProviderMappingRow, ScanRow } from "@/types/db";
import type { PlaceSummary } from "@/types/places";

import { fingerprintsFromSnapshots } from "./fingerprints";
import { adminClient, appendScanEvent, bumpScanCounters, claimScanJob, errorCodeOf, errorMessageOf, finishScanJob, isScanCancelled, stepLogger } from "./shared";

/** One provider query: a coverage cell crossed with a category. */
export interface DiscoveryUnit {
  cellIndex: number;
  categoryId: string;
}

export interface CoverageResult {
  units: DiscoveryUnit[];
  cells: number;
  areaKm2: number | null;
  notes: string[];
}

/**
 * Splits the scan area into coverage cells and writes one `scan_targets` row per
 * cell and category. A provider search returns at most ~20 results per call, so
 * a large area must be swept cell by cell; the plan records that this is a sweep
 * and not a census.
 */
export async function planCoverage(scanId: string): Promise<CoverageResult> {
  "use step";

  const client = adminClient();
  const scan = await loadScan(client, scanId);
  const settings = await getScanSettings();

  const polygon = (scan.polygon ?? null) as GeoPolygon | null;
  const center: GeoPoint | null = scan.center_lat !== null && scan.center_lng !== null ? { lat: scan.center_lat, lng: scan.center_lng } : null;

  const plan = buildCoveragePlan({
    method: scan.location_method,
    center: center ?? undefined,
    radiusM: scan.radius_m ?? undefined,
    polygon: polygon ?? undefined,
    cellRadiusM: settings.default_cell_radius_m,
    maxCells: Math.max(1, Math.floor(settings.max_businesses_per_scan / 4)),
  });

  const { data: categories } = await client.from("scan_categories").select("category_id").eq("scan_id", scanId).returns<{ category_id: string }[]>();
  const categoryIds = (categories ?? []).map((row) => row.category_id);
  if (categoryIds.length === 0) throw new FatalError(`Scan ${scanId} has no categories`);

  const targets = plan.cells.flatMap((cell) =>
    categoryIds.map((categoryId) => ({
      scan_id: scanId,
      workspace_id: scan.workspace_id,
      cell_index: cell.index,
      center_lat: cell.center.lat,
      center_lng: cell.center.lng,
      radius_m: cell.radiusM,
      category_id: categoryId,
      status: "pending" as const,
    })),
  );

  // Natural key (scan_id, cell_index, category_id) makes this replay-safe.
  const { error } = await client.from("scan_targets").upsert(targets, { onConflict: "scan_id,cell_index,category_id", ignoreDuplicates: true });
  if (error) throw new FatalError(`Could not create scan targets: ${error.message}`);

  await client
    .from("scans")
    .update({
      status: "discovering",
      total_targets: targets.length,
      area_km2: plan.areaKm2,
      coverage_metadata: { cells: plan.cells.length, notes: plan.notes, method: plan.method, cellRadiusM: settings.default_cell_radius_m },
    })
    .eq("id", scanId);

  await appendScanEvent(client, {
    scanId,
    workspaceId: scan.workspace_id,
    eventType: "coverage_planned",
    message: `Planned ${plan.cells.length} coverage cell(s) across ${categoryIds.length} category(ies)`,
    metadata: { cells: plan.cells.length, categories: categoryIds.length, notes: plan.notes },
  });

  return {
    units: targets.map((target) => ({ cellIndex: target.cell_index, categoryId: target.category_id })),
    cells: plan.cells.length,
    areaKm2: plan.areaKm2,
    notes: plan.notes,
  };
}

export interface DiscoverCellResult {
  found: number;
  inserted: number;
  outsideArea: number;
  duplicates: number;
  providerCalls: number;
  skipped: boolean;
}

/**
 * Runs the provider search for one cell and category and persists what it finds.
 *
 * Identity is written to `businesses` (unique on workspace + provider + place id)
 * and the provider payload to `business_provider_snapshots`, so replaying this
 * step cannot create duplicates. Provider rate limits become `RetryableError`
 * so the Workflow runtime backs off instead of failing the scan.
 */
export async function discoverCell(scanId: string, cellIndex: number, categoryId: string): Promise<DiscoverCellResult> {
  "use step";

  const client = adminClient();
  const empty: DiscoverCellResult = { found: 0, inserted: 0, outsideArea: 0, duplicates: 0, providerCalls: 0, skipped: true };
  if (await isScanCancelled(client, scanId)) return empty;

  const scan = await loadScan(client, scanId);
  const idempotencyKey = `scan:${scanId}:discover:${cellIndex}:${categoryId}`;
  const job = await claimScanJob(client, { scanId, workspaceId: scan.workspace_id, jobType: "discovery", idempotencyKey });
  if (!job.claimed) return empty;

  try {
    const { data: target } = await client
      .from("scan_targets")
      .select("id, center_lat, center_lng, radius_m")
      .eq("scan_id", scanId)
      .eq("cell_index", cellIndex)
      .eq("category_id", categoryId)
      .maybeSingle<{ id: string; center_lat: number; center_lng: number; radius_m: number }>();
    if (!target) throw new FatalError(`Scan target ${scanId}/${cellIndex}/${categoryId} is missing`);

    await client.from("scan_targets").update({ status: "running" }).eq("id", target.id);

    // Stop early once the scan has collected everything the user asked for.
    const remaining = await remainingCapacity(client, scanId, scan.max_businesses);
    if (remaining <= 0) {
      await client.from("scan_targets").update({ status: "skipped", completed_at: new Date().toISOString() }).eq("id", target.id);
      await finishScanJob(client, job.jobId, "skipped");
      return { ...empty, skipped: true };
    }

    const provider = getPlaceProvider();
    const mappings = await loadCategoryMappings(client, categoryId, provider.name);
    if (mappings.length === 0) {
      await client.from("scan_targets").update({ status: "skipped", completed_at: new Date().toISOString() }).eq("id", target.id);
      await finishScanJob(client, job.jobId, "skipped");
      return { ...empty, skipped: true };
    }

    const center: GeoPoint = { lat: target.center_lat, lng: target.center_lng };
    const collected: PlaceSummary[] = [];
    let providerCalls = 0;

    for (const mapping of mappings) {
      const result = await provider.searchBusinesses({
        area: { center, radiusM: target.radius_m },
        providerType: mapping.provider_type ?? undefined,
        query: mapping.query_text ?? undefined,
        maxResults: 20,
        context: { workspaceId: scan.workspace_id, scanId, cellIndex },
      });
      providerCalls += result.providerCalls;
      collected.push(...result.places);
    }

    const deduped = dedupePlaces(collected);
    const polygon = (scan.polygon ?? null) as GeoPolygon | null;
    const filtered = polygon
      ? filterPlacesToPolygon(deduped.unique, polygon)
      : filterPlacesToRadius(deduped.unique, { lat: scan.center_lat ?? center.lat, lng: scan.center_lng ?? center.lng }, scan.radius_m ?? target.radius_m);

    const accepted = filtered.inside.slice(0, remaining);
    const inserted = await persistDiscoveredPlaces(client, {
      scanId,
      workspaceId: scan.workspace_id,
      categoryId,
      places: accepted,
      providerName: provider.name,
    });

    await client
      .from("scan_targets")
      .update({ status: "completed", results_count: accepted.length, provider_calls: providerCalls, completed_at: new Date().toISOString() })
      .eq("id", target.id);
    await bumpScanCounters(client, scanId, { discovered: inserted, deduplicated: deduped.duplicatesRemoved });
    await finishScanJob(client, job.jobId, "completed");

    return {
      found: collected.length,
      inserted,
      outsideArea: filtered.outside,
      duplicates: deduped.duplicatesRemoved,
      providerCalls,
      skipped: false,
    };
  } catch (err) {
    const code = errorCodeOf(err);
    await client
      .from("scan_targets")
      .update({ status: "failed", error_code: code, completed_at: new Date().toISOString() })
      .eq("scan_id", scanId)
      .eq("cell_index", cellIndex)
      .eq("category_id", categoryId);
    await finishScanJob(client, job.jobId, "failed", { code, message: errorMessageOf(err) });
    await appendScanEvent(client, {
      scanId,
      workspaceId: scan.workspace_id,
      eventType: "discovery_cell_failed",
      level: "warn",
      message: errorMessageOf(err).slice(0, 300),
      metadata: { cellIndex, categoryId, code },
    });

    // Transient provider conditions back off and retry; everything else is fatal
    // for this cell only, so the rest of the sweep continues.
    if (err instanceof AppError && err.retryable) {
      throw new RetryableError(`Provider unavailable for cell ${cellIndex}`, { retryAfter: err.retryAfterMs ?? Math.min(60_000, (job.attempt || 1) ** 2 * 1000) });
    }
    throw err;
  }
}

discoverCell.maxRetries = 3;

export interface DedupeResultSummary {
  examined: number;
  duplicatesMarked: number;
}

/**
 * Second-pass deduplication inside a scan. The provider place id already made
 * discovery idempotent; this catches the same business listed twice under
 * different ids by comparing a normalised name + address + coordinate
 * fingerprint, and marks the later membership rows as skipped.
 */
export async function dedupeScanBusinesses(scanId: string): Promise<DedupeResultSummary> {
  "use step";

  const client = adminClient();
  const scan = await loadScan(client, scanId);
  if (await isScanCancelled(client, scanId)) return { examined: 0, duplicatesMarked: 0 };

  await client.from("scans").update({ status: "deduplicating" }).eq("id", scanId);

  const { data: rows } = await client
    .from("scan_businesses")
    .select("id, business_id, discovered_at")
    .eq("scan_id", scanId)
    .eq("audit_status", "pending")
    .order("discovered_at", { ascending: true })
    .returns<Array<{ id: string; business_id: string; discovered_at: string }>>();

  const members = rows ?? [];
  const fingerprints = await fingerprintsFromSnapshots(
    client,
    members.map((row) => row.business_id),
  );

  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const row of members) {
    const fingerprint = fingerprints.get(row.business_id);
    if (!fingerprint) continue;
    if (seen.has(fingerprint)) duplicates.push(row.id);
    else seen.add(fingerprint);
  }

  if (duplicates.length > 0) {
    await client.from("scan_businesses").update({ audit_status: "skipped", opportunity_status: "skipped" }).in("id", duplicates);
    await appendScanEvent(client, {
      scanId,
      workspaceId: scan.workspace_id,
      eventType: "duplicates_removed",
      message: `${duplicates.length} duplicate business(es) skipped`,
      metadata: { duplicates: duplicates.length },
    });
  }

  return { examined: rows?.length ?? 0, duplicatesMarked: duplicates.length };
}

// ---------------------------------------------------------------------------
// helpers (plain functions; only steps touch the database)
// ---------------------------------------------------------------------------

async function loadScan(client: SupabaseClient, scanId: string): Promise<ScanRow> {
  const { data, error } = await client.from("scans").select("*").eq("id", scanId).maybeSingle<ScanRow>();
  if (error || !data) throw new FatalError(`Scan ${scanId} could not be loaded`);
  return data;
}

async function loadCategoryMappings(client: SupabaseClient, categoryId: string, provider: string): Promise<CategoryProviderMappingRow[]> {
  const { data } = await client
    .from("category_provider_mappings")
    .select("*")
    .eq("category_id", categoryId)
    .eq("provider", provider)
    .eq("active", true)
    .order("priority")
    .returns<CategoryProviderMappingRow[]>();
  return data ?? [];
}

async function remainingCapacity(client: SupabaseClient, scanId: string, maxBusinesses: number): Promise<number> {
  const { count } = await client.from("scan_businesses").select("id", { count: "exact", head: true }).eq("scan_id", scanId);
  return Math.max(0, maxBusinesses - (count ?? 0));
}

/**
 * Writes identity, the provider snapshot and scan membership for each place.
 * Returns how many businesses were newly added to this scan.
 */
async function persistDiscoveredPlaces(
  client: SupabaseClient,
  input: { scanId: string; workspaceId: string; categoryId: string; places: PlaceSummary[]; providerName: string },
): Promise<number> {
  if (input.places.length === 0) return 0;

  const policy = getPolicy(input.providerName);
  const now = new Date();
  const expiresAt = snapshotExpiryDate(policy, now).toISOString();

  const businessRows = input.places.map((place) => ({
    workspace_id: input.workspaceId,
    provider: place.provider,
    provider_place_id: place.providerPlaceId,
    // normalized_name and canonical_fingerprint are deliberately left unset.
    // `businesses` never expires, so provider-derived identity here would be an
    // indefinite secondary copy of Places content. The durable identity is
    // provider + place id; matching material lives in the snapshot cache, which
    // expires, and dedupe derives its fingerprint from there at scan time.
    primary_category_id: input.categoryId,
    first_scan_id: input.scanId,
    last_seen_at: now.toISOString(),
  }));

  const { data: businesses, error } = await client
    .from("businesses")
    .upsert(businessRows, { onConflict: "workspace_id,provider,provider_place_id" })
    .select("id, provider_place_id")
    .returns<Array<{ id: string; provider_place_id: string }>>();
  if (error) throw error;

  const idByPlaceId = new Map((businesses ?? []).map((row) => [row.provider_place_id, row.id]));

  const snapshotRows = input.places
    .map((place) => {
      const businessId = idByPlaceId.get(place.providerPlaceId);
      if (!businessId) return null;
      return {
        business_id: businessId,
        workspace_id: input.workspaceId,
        provider: place.provider,
        provider_place_id: place.providerPlaceId,
        display_name: place.displayName,
        formatted_address: place.formattedAddress,
        lat: place.location?.lat ?? null,
        lng: place.location?.lng ?? null,
        city: place.city,
        district: place.district,
        country_code: place.countryCode,
        primary_type: place.primaryType,
        types: place.types,
        business_status: place.businessStatus,
        detail_level: "discovery" as const,
        fetched_at: now.toISOString(),
        expires_at: expiresAt,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (snapshotRows.length > 0) {
    const { error: snapshotError } = await client.from("business_provider_snapshots").insert(snapshotRows);
    if (snapshotError) stepLogger.warn("snapshot_insert_failed", { scanId: input.scanId, error: snapshotError.message });
  }

  const membershipRows = input.places
    .map((place, index) => {
      const businessId = idByPlaceId.get(place.providerPlaceId);
      if (!businessId) return null;
      return {
        scan_id: input.scanId,
        business_id: businessId,
        workspace_id: input.workspaceId,
        matched_category_id: input.categoryId,
        discovery_position: index,
        discovered_at: now.toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const { data: memberships, error: membershipError } = await client
    .from("scan_businesses")
    .upsert(membershipRows, { onConflict: "scan_id,business_id", ignoreDuplicates: true })
    .select("id")
    .returns<Array<{ id: string }>>();
  if (membershipError) throw membershipError;

  return memberships?.length ?? 0;
}
