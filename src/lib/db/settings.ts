import "server-only";

import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import type { Json } from "@/types/common";

/**
 * system_settings access with a short in-process cache. Settings are platform
 * configuration (feature flags, limits, provider config) — never secrets.
 */
const TTL_MS = 30_000;
const cache = new Map<string, { value: Json | undefined; expires: number }>();

export async function getSystemSetting<T>(key: string, fallback: T): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return (hit.value === undefined ? fallback : hit.value) as T;
  if (!isAdminClientConfigured()) return fallback;
  const { data, error } = await createAdminClient().from("system_settings").select("value").eq("key", key).maybeSingle<{ value: Json }>();
  const value = error || !data ? undefined : data.value;
  cache.set(key, { value, expires: now + TTL_MS });
  return (value === undefined ? fallback : value) as T;
}

export async function setSystemSetting(key: string, value: Json, updatedBy?: string, description?: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("system_settings")
    .upsert({ key, value, updated_by: updatedBy ?? null, description: description ?? null, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  cache.delete(key);
}

export function invalidateSettingsCache(key?: string) {
  if (key) cache.delete(key);
  else cache.clear();
}

export interface FeatureFlags {
  real_payments: boolean;
  competitor_benchmark: boolean;
  pagespeed: boolean;
  instagram_discovery: boolean;
  export_provider_content: boolean;
  public_reports: boolean;
  api_keys: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  real_payments: false,
  competitor_benchmark: true,
  pagespeed: true,
  instagram_discovery: true,
  export_provider_content: false,
  public_reports: true,
  // Off until the other half exists. The settings screen can mint, list and
  // revoke keys, but nothing in the request path ever verifies one -- there is
  // no API-key authentication layer. Shipping it enabled hands people a
  // credential that grants nothing and implies an access model the application
  // does not implement. Turn this on in the same change that adds verification.
  api_keys: false,
};

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const stored = await getSystemSetting<Partial<FeatureFlags>>("features", {});
  return { ...DEFAULT_FLAGS, ...stored };
}

export interface ScanSettings {
  max_businesses_per_scan: number;
  max_radius_m: number;
  min_radius_m: number;
  default_cell_radius_m: number;
  max_polygon_area_km2: number;
  secondary_service_threshold: number;
  high_opportunity_threshold: number;
  audit_concurrency: number;
}

export const DEFAULT_SCAN_SETTINGS: ScanSettings = {
  max_businesses_per_scan: 200,
  max_radius_m: 15000,
  min_radius_m: 200,
  default_cell_radius_m: 800,
  max_polygon_area_km2: 60,
  secondary_service_threshold: 50,
  high_opportunity_threshold: 70,
  audit_concurrency: 5,
};

export async function getScanSettings(): Promise<ScanSettings> {
  const stored = await getSystemSetting<Partial<ScanSettings>>("scan", {});
  return { ...DEFAULT_SCAN_SETTINGS, ...stored };
}

export interface AISettings {
  default_tone: string;
  max_output_tokens: number;
  temperature: number;
  prompt_version: string;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  default_tone: "friendly_professional",
  max_output_tokens: 700,
  temperature: 0.7,
  prompt_version: "v1",
};

export async function getAISettings(): Promise<AISettings> {
  const stored = await getSystemSetting<Partial<AISettings>>("ai", {});
  return { ...DEFAULT_AI_SETTINGS, ...stored };
}
