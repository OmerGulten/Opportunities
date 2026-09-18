import "server-only";

import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import type { CategoryProviderMappingRow, CategoryRow, CreditPricingRuleRow, PlanRow, ScanJobRow, ScanRow, ServiceRow, ServiceRuleRow } from "@/types/db";

/**
 * Read-only platform queries for the admin segment.
 *
 * `src/features/admin/service.ts` owns everything that writes; these are the
 * reference-table reads the admin screens need in their *unfiltered* form
 * (including inactive rows, which the shared `lib/db/reference` readers hide).
 * They run on the service-role client, which is allowed here because every
 * caller sits behind `requirePlatformAdmin()` — see docs/conventions.md.
 *
 * Each function degrades to an empty result when the service-role key is not
 * configured, so a misconfigured environment shows a notice instead of a crash.
 */

export function isPlatformDataAvailable(): boolean {
  return isAdminClientConfigured();
}

export async function listAllPlans(): Promise<PlanRow[]> {
  if (!isAdminClientConfigured()) return [];
  const { data, error } = await createAdminClient().from("plans").select("*").order("sort_order").returns<PlanRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function listAllCreditPricingRules(): Promise<CreditPricingRuleRow[]> {
  if (!isAdminClientConfigured()) return [];
  const { data, error } = await createAdminClient().from("credit_pricing_rules").select("*").order("key").returns<CreditPricingRuleRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function listAllServices(): Promise<ServiceRow[]> {
  if (!isAdminClientConfigured()) return [];
  const { data, error } = await createAdminClient().from("services").select("*").order("sort_order").returns<ServiceRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function listAllServiceRules(): Promise<ServiceRuleRow[]> {
  if (!isAdminClientConfigured()) return [];
  const { data, error } = await createAdminClient().from("service_rules").select("*").order("sort_order").returns<ServiceRuleRow[]>();
  if (error) throw error;
  return data ?? [];
}

export interface AdminCategory {
  category: CategoryRow;
  mappings: CategoryProviderMappingRow[];
}

export async function listAllCategories(): Promise<AdminCategory[]> {
  if (!isAdminClientConfigured()) return [];
  const client = createAdminClient();
  const [categories, mappings] = await Promise.all([
    client.from("categories").select("*").order("sort_order").returns<CategoryRow[]>(),
    client.from("category_provider_mappings").select("*").order("priority").returns<CategoryProviderMappingRow[]>(),
  ]);
  if (categories.error) throw categories.error;
  if (mappings.error) throw mappings.error;

  const byCategory = new Map<string, CategoryProviderMappingRow[]>();
  for (const mapping of mappings.data ?? []) {
    const list = byCategory.get(mapping.category_id);
    if (list) list.push(mapping);
    else byCategory.set(mapping.category_id, [mapping]);
  }
  return (categories.data ?? []).map((category) => ({ category, mappings: byCategory.get(category.id) ?? [] }));
}

export interface FailedJobView {
  job: ScanJobRow;
  scanName: string | null;
  scanStatus: ScanRow["status"] | null;
}

/** Resolves the scan each failed job belongs to so the row is readable without a second lookup. */
export async function describeFailedJobs(jobs: readonly ScanJobRow[]): Promise<FailedJobView[]> {
  if (jobs.length === 0 || !isAdminClientConfigured()) return jobs.map((job) => ({ job, scanName: null, scanStatus: null }));

  const scanIds = [...new Set(jobs.map((job) => job.scan_id))];
  const { data } = await createAdminClient()
    .from("scans")
    .select("id, name, status")
    .in("id", scanIds)
    .returns<Array<Pick<ScanRow, "id" | "name" | "status">>>();

  const byId = new Map((data ?? []).map((scan) => [scan.id, scan]));
  return jobs.map((job) => {
    const scan = byId.get(job.scan_id);
    return { job, scanName: scan?.name ?? null, scanStatus: scan?.status ?? null };
  });
}
