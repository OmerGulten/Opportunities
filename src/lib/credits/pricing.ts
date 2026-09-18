import type { AuditDepth } from "@/types/common";
import type { CreditPricingRuleRow } from "@/types/db";

/**
 * Credit pricing. Costs come from `credit_pricing_rules` (platform-admin editable);
 * this module turns those rows into a table and produces estimates for the scan
 * wizard. Estimates are labelled with pricing keys only; the UI translates them.
 */

export interface PricingTable {
  discovery: number;
  basic_audit: number;
  deep_audit: number;
  ai_message: number;
  report: number;
  competitor_benchmark: number;
}

export type PricingKey = keyof PricingTable;

export const PRICING_KEYS: readonly PricingKey[] = [
  "discovery",
  "basic_audit",
  "deep_audit",
  "ai_message",
  "report",
  "competitor_benchmark",
] as const;

/** Mirrors supabase/seed.sql. Used when a rule row is missing or inactive. */
export const DEFAULT_PRICING_TABLE: PricingTable = {
  discovery: 1,
  basic_audit: 2,
  deep_audit: 4,
  ai_message: 1,
  report: 1,
  competitor_benchmark: 3,
};

/** Google Places (New) Nearby Search returns at most 20 results per call. */
export const DEFAULT_PROVIDER_MAX_PER_CALL = 20;

/**
 * Expected fill ratio of a coverage cell x category call. Cells in dense areas hit
 * the provider cap, sparse cells and overlapping categories return fewer unique
 * businesses; 0.6 is a deliberately conservative middle for the estimate.
 */
export const DISCOVERY_FILL_FACTOR = 0.6;

export function isPricingKey(value: unknown): value is PricingKey {
  return typeof value === "string" && (PRICING_KEYS as readonly string[]).includes(value);
}

/**
 * Build the table from rule rows. Inactive rows are ignored (same as a missing
 * key) so behaviour matches `listCreditPricingRules`, which only loads active
 * rules; a rule that should be free must have `cost = 0` and stay active.
 */
export function buildPricingTable(rows: readonly CreditPricingRuleRow[]): PricingTable {
  const table: PricingTable = { ...DEFAULT_PRICING_TABLE };
  for (const row of rows) {
    if (!row.active || !isPricingKey(row.key)) continue;
    if (!Number.isInteger(row.cost) || row.cost < 0) continue;
    table[row.key] = row.cost;
  }
  return table;
}

/** Credits consumed for one business at the given audit depth (discovery is always paid). */
export function perBusinessCost(depth: AuditDepth, table: PricingTable): number {
  switch (depth) {
    case "discovery":
      return table.discovery;
    case "basic":
      return table.discovery + table.basic_audit;
    case "deep":
      return table.discovery + table.deep_audit;
  }
}

export interface ScanEstimateInput {
  estimatedBusinesses: number;
  depth: AuditDepth;
  includeBenchmark?: boolean;
}

export interface ScanEstimateLine {
  key: PricingKey;
  unitCost: number;
  quantity: number;
  total: number;
}

export interface ScanCreditEstimate {
  perBusiness: number;
  businesses: number;
  /** Discovery + audit for all businesses. */
  subtotal: number;
  /** Competitor benchmark for all businesses (0 when not requested). */
  benchmark: number;
  total: number;
  breakdown: ScanEstimateLine[];
}

export function estimateScanCredits(input: ScanEstimateInput, table: PricingTable): ScanCreditEstimate {
  const businesses = toCount(input.estimatedBusinesses);
  const perBusiness = perBusinessCost(input.depth, table);
  const includeBenchmark = input.includeBenchmark === true;

  const breakdown: ScanEstimateLine[] = [line("discovery", table.discovery, businesses)];
  if (input.depth === "basic") breakdown.push(line("basic_audit", table.basic_audit, businesses));
  if (input.depth === "deep") breakdown.push(line("deep_audit", table.deep_audit, businesses));
  if (includeBenchmark) breakdown.push(line("competitor_benchmark", table.competitor_benchmark, businesses));

  const subtotal = perBusiness * businesses;
  const benchmark = includeBenchmark ? table.competitor_benchmark * businesses : 0;

  return { perBusiness, businesses, subtotal, benchmark, total: subtotal + benchmark, breakdown };
}

export interface BusinessCountEstimateInput {
  /** Coverage cells the area was split into. */
  cells: number;
  /** Categories selected for the scan. */
  categories: number;
  /** Hard cap chosen by the user / plan. */
  maxBusinesses: number;
  providerMaxPerCall?: number;
}

/**
 * Rough number of unique businesses a scan will discover. Provider results are not
 * a census, so this is an upper-bound style estimate capped by `maxBusinesses`;
 * the reservation made from it is refunded for businesses never found.
 */
export function estimateBusinessCount(input: BusinessCountEstimateInput): number {
  const cells = toCount(input.cells);
  const categories = toCount(input.categories);
  const maxBusinesses = toCount(input.maxBusinesses);
  const perCall = toCount(input.providerMaxPerCall ?? DEFAULT_PROVIDER_MAX_PER_CALL);
  if (cells === 0 || categories === 0) return 0;
  const raw = Math.round(cells * categories * perCall * DISCOVERY_FILL_FACTOR);
  return Math.max(1, Math.min(maxBusinesses, raw));
}

function line(key: PricingKey, unitCost: number, quantity: number): ScanEstimateLine {
  return { key, unitCost, quantity, total: unitCost * quantity };
}

/** Coerce user-supplied numbers into a non-negative integer count. */
function toCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}
