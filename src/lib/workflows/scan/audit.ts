import type { SupabaseClient } from "@supabase/supabase-js";
import { FatalError, RetryableError } from "workflow";

import type { ScanFilters } from "@/features/scans/schemas";
import { runBusinessAudit } from "@/lib/audits/run-business-audit";
import { toAuditRows } from "@/lib/audits/mappers";
import { creditKeys, REFERENCE_TYPES } from "@/lib/credits/keys";
import { buildPricingTable, perBusinessCost } from "@/lib/credits/pricing";
import { getCreditService } from "@/lib/credits/server";
import { getFeatureFlags, getScanSettings } from "@/lib/db/settings";
import { AppError } from "@/lib/errors";
import { createDemoFetcher } from "@/lib/demo/websites";
import { getPerformanceProvider, getPlaceProvider } from "@/lib/providers/registry";
import { getPolicy, snapshotExpiryDate } from "@/lib/providers/policy";
import { ruleFromRow, scoreBusiness, serviceFromRow, toOpportunityRow, toOpportunityScoreRows } from "@/lib/scoring";
import { safeFetchUrl, type SafeFetcher } from "@/lib/security/safe-fetch";
import type { Locale } from "@/types/common";
import type { BusinessRow, CreditPricingRuleRow, ScanRow, ServiceRow, ServiceRuleRow } from "@/types/db";
import type { PlaceDetails } from "@/types/places";

import { passesPostAuditFilters, passesPreAuditFilters } from "./filters";
import { adminClient, appendScanEvent, bumpScanCounters, claimScanJob, errorCodeOf, errorMessageOf, finishScanJob, isScanCancelled, stepLogger } from "./shared";

/** Businesses of a scan that still need auditing, oldest discovery first. */
export async function listPendingBusinesses(scanId: string): Promise<string[]> {
  "use step";

  const client = adminClient();
  const { data } = await client
    .from("scan_businesses")
    .select("business_id")
    .eq("scan_id", scanId)
    .in("audit_status", ["pending", "failed"])
    .order("discovered_at", { ascending: true })
    .returns<Array<{ business_id: string }>>();
  return (data ?? []).map((row) => row.business_id);
}

export interface AuditBusinessResult {
  businessId: string;
  status: "scored" | "filtered" | "failed" | "skipped";
  score: number | null;
  primaryServiceKey: string | null;
  creditsConsumed: number;
}

/**
 * Audits and scores one business, then bills it.
 *
 * Everything for a single business happens in one step so a failure isolates to
 * that business: the scan continues and only this row is marked failed. The step
 * is idempotent through `scan_jobs.idempotency_key` and the per-business credit
 * key, so a replay after a crash neither double-charges nor double-writes.
 */
export async function auditAndScoreBusiness(scanId: string, businessId: string, runKey?: string): Promise<AuditBusinessResult> {
  "use step";

  const client = adminClient();
  const skipped: AuditBusinessResult = { businessId, status: "skipped", score: null, primaryServiceKey: null, creditsConsumed: 0 };
  if (await isScanCancelled(client, scanId)) return skipped;

  const scan = await loadScan(client, scanId);
  // A manual refresh passes its own run key so it is not mistaken for the
  // original scan's already-completed job (and is billed as its own audit).
  const idempotencyKey = runKey ? `scan:${scanId}:audit:${businessId}:${runKey}` : `scan:${scanId}:audit:${businessId}`;
  const job = await claimScanJob(client, { scanId, workspaceId: scan.workspace_id, jobType: "audit", idempotencyKey, businessId });
  if (!job.claimed) return skipped;

  const filters = (scan.filters ?? {}) as Partial<ScanFilters>;
  const locale: Locale = await workspaceLocale(client, scan.workspace_id);

  try {
    await client.from("scan_businesses").update({ audit_status: "running" }).eq("scan_id", scanId).eq("business_id", businessId);

    const business = await loadBusiness(client, businessId);
    const provider = getPlaceProvider();
    const pricing = buildPricingTable(await loadPricingRows(client));

    // ---- provider details -------------------------------------------------
    const details = await provider.getBusinessDetails(business.provider_place_id, {
      depth: scan.audit_depth,
      context: { workspaceId: scan.workspace_id, scanId, businessId },
    });
    await persistSnapshot(client, { businessId, workspaceId: scan.workspace_id, details, providerName: provider.name, depth: scan.audit_depth });

    // Cheap filters run before the expensive website/Instagram work so a scan
    // does not pay to audit businesses the user already excluded.
    if (!passesPreAuditFilters(details, filters, scan.audit_depth)) {
      const cost = pricing.discovery;
      await consumeCredits(scan, businessId, cost, runKey);
      await client
        .from("scan_businesses")
        .update({ audit_status: "skipped", opportunity_status: "skipped" })
        .eq("scan_id", scanId)
        .eq("business_id", businessId);
      await bumpScanCounters(client, scanId, { consumed: cost });
      await finishScanJob(client, job.jobId, "completed");
      return { businessId, status: "filtered", score: null, primaryServiceKey: null, creditsConsumed: cost };
    }

    // ---- audits ------------------------------------------------------------
    const flags = await getFeatureFlags();
    const bundle = await runBusinessAudit({
      details,
      depth: scan.audit_depth,
      locale,
      fetcher: fetcherFor(provider.isDemo),
      performanceProvider: getPerformanceProvider(),
      features: { instagramDiscovery: flags.instagram_discovery, performance: flags.pagespeed },
    });

    await persistAudits(client, { bundle, businessId, workspaceId: scan.workspace_id, scanId, depth: scan.audit_depth });
    await bumpScanCounters(client, scanId, { audited: 1 });
    await client.from("scan_businesses").update({ audit_status: "completed" }).eq("scan_id", scanId).eq("business_id", businessId);

    // ---- scoring -----------------------------------------------------------
    const { services, rules } = await loadScoringInputs(client, scanId);
    const result = scoreBusiness(bundle.signals, rules, services, {
      locale,
      auditDepth: scan.audit_depth,
      serviceIds: services.map((service) => service.id),
      secondaryThreshold: (await getScanSettings()).secondary_service_threshold,
    });

    const opportunityId = await persistOpportunity(client, { result, businessId, workspaceId: scan.workspace_id, scanId });

    const matchesPost = passesPostAuditFilters(bundle.signals, filters);
    await client
      .from("scan_businesses")
      .update({ opportunity_status: matchesPost ? "completed" : "skipped" })
      .eq("scan_id", scanId)
      .eq("business_id", businessId);

    const cost = perBusinessCost(scan.audit_depth, pricing);
    await consumeCredits(scan, businessId, cost, runKey);
    await bumpScanCounters(client, scanId, { scored: 1, consumed: cost });
    await finishScanJob(client, job.jobId, "completed");

    stepLogger.info("business_scored", {
      scanId,
      businessId,
      score: result.overallScore,
      primary: result.primaryServiceKey,
      opportunityId,
    });

    return {
      businessId,
      status: matchesPost ? "scored" : "filtered",
      score: result.overallScore,
      primaryServiceKey: result.primaryServiceKey,
      creditsConsumed: cost,
    };
  } catch (err) {
    const code = errorCodeOf(err);
    await client
      .from("scan_businesses")
      .update({ audit_status: "failed", opportunity_status: "failed" })
      .eq("scan_id", scanId)
      .eq("business_id", businessId);
    await bumpScanCounters(client, scanId, { failed: 1 });
    await finishScanJob(client, job.jobId, "failed", { code, message: errorMessageOf(err) });
    await appendScanEvent(client, {
      scanId,
      workspaceId: scan.workspace_id,
      eventType: "business_audit_failed",
      level: "warn",
      message: errorMessageOf(err).slice(0, 300),
      metadata: { businessId, code },
    });

    if (err instanceof AppError && err.retryable) {
      throw new RetryableError(`Audit for ${businessId} hit a transient error`, {
        retryAfter: err.retryAfterMs ?? Math.min(60_000, (job.attempt || 1) ** 2 * 1000),
      });
    }
    return { businessId, status: "failed", score: null, primaryServiceKey: null, creditsConsumed: 0 };
  }
}

auditAndScoreBusiness.maxRetries = 2;

// ---------------------------------------------------------------------------
// persistence helpers
// ---------------------------------------------------------------------------

function fetcherFor(isDemo: boolean): SafeFetcher {
  // Demo websites are fixtures, not real hosts: the SSRF-hardened fetcher would
  // correctly refuse to resolve them, so demo runs use the fixture fetcher.
  return isDemo ? createDemoFetcher() : safeFetchUrl;
}

async function loadScan(client: SupabaseClient, scanId: string): Promise<ScanRow> {
  const { data, error } = await client.from("scans").select("*").eq("id", scanId).maybeSingle<ScanRow>();
  if (error || !data) throw new FatalError(`Scan ${scanId} could not be loaded`);
  return data;
}

async function loadBusiness(client: SupabaseClient, businessId: string): Promise<BusinessRow> {
  const { data, error } = await client.from("businesses").select("*").eq("id", businessId).maybeSingle<BusinessRow>();
  if (error || !data) throw new FatalError(`Business ${businessId} could not be loaded`);
  return data;
}

async function workspaceLocale(client: SupabaseClient, workspaceId: string): Promise<Locale> {
  const { data } = await client.from("workspaces").select("default_locale").eq("id", workspaceId).maybeSingle<{ default_locale: Locale }>();
  return data?.default_locale ?? "tr";
}

async function loadPricingRows(client: SupabaseClient): Promise<CreditPricingRuleRow[]> {
  const { data } = await client.from("credit_pricing_rules").select("*").eq("active", true).returns<CreditPricingRuleRow[]>();
  return data ?? [];
}

async function loadScoringInputs(client: SupabaseClient, scanId: string) {
  const { data: scanServices } = await client.from("scan_services").select("service_id").eq("scan_id", scanId).returns<Array<{ service_id: string }>>();
  const serviceIds = (scanServices ?? []).map((row) => row.service_id);
  if (serviceIds.length === 0) return { services: [], rules: [] };

  const [{ data: serviceRows }, { data: ruleRows }] = await Promise.all([
    client.from("services").select("*").in("id", serviceIds).returns<ServiceRow[]>(),
    client.from("service_rules").select("*").in("service_id", serviceIds).eq("active", true).returns<ServiceRuleRow[]>(),
  ]);

  return {
    services: (serviceRows ?? []).map(serviceFromRow),
    rules: (ruleRows ?? []).map(ruleFromRow),
  };
}

async function persistSnapshot(
  client: SupabaseClient,
  input: { businessId: string; workspaceId: string; details: PlaceDetails; providerName: string; depth: ScanRow["audit_depth"] },
): Promise<void> {
  const policy = getPolicy(input.providerName);
  const now = new Date();
  const details = input.details;

  const { error } = await client.from("business_provider_snapshots").insert({
    business_id: input.businessId,
    workspace_id: input.workspaceId,
    provider: details.provider,
    provider_place_id: details.providerPlaceId,
    display_name: details.displayName,
    formatted_address: details.formattedAddress,
    lat: details.location?.lat ?? null,
    lng: details.location?.lng ?? null,
    city: details.city,
    district: details.district,
    country_code: details.countryCode,
    primary_type: details.primaryType,
    types: details.types,
    business_status: details.businessStatus,
    rating: details.rating,
    user_rating_count: details.userRatingCount,
    website_uri: details.websiteUri,
    phone_national: details.phoneNational,
    phone_international: details.phoneInternational,
    google_maps_uri: details.googleMapsUri,
    opening_hours: details.openingHours,
    has_opening_hours: details.openingHours ? details.openingHours.periodsCount > 0 || details.openingHours.weekdayDescriptions.length > 0 : null,
    photo_count: details.photoCount,
    price_level: details.priceLevel,
    review_sample: details.reviewSample,
    detail_level: input.depth,
    field_mask: details.fieldMask,
    fetched_at: now.toISOString(),
    expires_at: snapshotExpiryDate(policy, now).toISOString(),
  });
  if (error) stepLogger.warn("detail_snapshot_insert_failed", { businessId: input.businessId, error: error.message });
}

async function persistAudits(
  client: SupabaseClient,
  input: { bundle: Awaited<ReturnType<typeof runBusinessAudit>>; businessId: string; workspaceId: string; scanId: string; depth: ScanRow["audit_depth"] },
): Promise<void> {
  const rows = toAuditRows(input.bundle, {
    businessId: input.businessId,
    workspaceId: input.workspaceId,
    scanId: input.scanId,
    depth: input.depth,
  });

  const { data: inserted, error } = await client.from("business_audits").insert(rows.audits).select("id").returns<Array<{ id: string }>>();
  if (error) throw error;

  const findingRows = (inserted ?? []).flatMap((audit, index) => rows.findingsFor(index, audit.id));
  if (findingRows.length > 0) {
    const { error: findingError } = await client.from("audit_findings").insert(findingRows);
    if (findingError) stepLogger.warn("finding_insert_failed", { businessId: input.businessId, error: findingError.message });
  }

  // Signals are the scoring input: one row per signal type, replaced on re-audit.
  const signalRows = rows.signalRows();
  if (signalRows.length > 0) {
    const { error: signalError } = await client.from("opportunity_signals").upsert(signalRows, { onConflict: "business_id,signal_type" });
    if (signalError) throw signalError;
  }
}

async function persistOpportunity(
  client: SupabaseClient,
  input: { result: ReturnType<typeof scoreBusiness>; businessId: string; workspaceId: string; scanId: string },
): Promise<string | null> {
  const { data: opportunity, error } = await client
    .from("opportunities")
    .upsert(toOpportunityRow(input.result, { businessId: input.businessId, workspaceId: input.workspaceId, scanId: input.scanId }), { onConflict: "business_id" })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (!opportunity) return null;

  const scoreRows = toOpportunityScoreRows(input.result, {
    opportunityId: opportunity.id,
    businessId: input.businessId,
    workspaceId: input.workspaceId,
  });
  if (scoreRows.length > 0) {
    const { error: scoreError } = await client.from("opportunity_scores").upsert(scoreRows, { onConflict: "opportunity_id,service_id" });
    if (scoreError) throw scoreError;
  }
  return opportunity.id;
}

async function consumeCredits(scan: ScanRow, businessId: string, amount: number, runKey?: string): Promise<void> {
  if (amount <= 0) return;
  const base = creditKeys.scanBusiness(scan.id, businessId);
  await getCreditService().consume({
    workspaceId: scan.workspace_id,
    amount,
    referenceType: REFERENCE_TYPES.scan,
    referenceId: scan.id,
    // A refresh is a separate audit and is billed separately from the scan run.
    idempotencyKey: runKey ? base + ":" + runKey : base,
    metadata: { businessId, depth: scan.audit_depth, refresh: runKey ?? null },
  });
}
