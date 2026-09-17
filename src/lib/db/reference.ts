import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Locale } from "@/types/common";
import type { CategoryRow, CreditPricingRuleRow, PlanRow, ServiceRow, ServiceRuleRow } from "@/types/db";

/**
 * Reference data readers. Work with any client (user-scoped or admin) because
 * reference tables are readable by all authenticated users.
 */

export async function listCategories(supabase: SupabaseClient, opts: { activeOnly?: boolean } = { activeOnly: true }): Promise<CategoryRow[]> {
  let q = supabase.from("categories").select("*").order("sort_order");
  if (opts.activeOnly) q = q.eq("active", true);
  const { data, error } = await q.returns<CategoryRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function listServices(supabase: SupabaseClient, opts: { activeOnly?: boolean } = { activeOnly: true }): Promise<ServiceRow[]> {
  let q = supabase.from("services").select("*").order("sort_order");
  if (opts.activeOnly) q = q.eq("active", true);
  const { data, error } = await q.returns<ServiceRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function listServiceRules(supabase: SupabaseClient, opts: { serviceIds?: string[]; activeOnly?: boolean } = { activeOnly: true }): Promise<ServiceRuleRow[]> {
  let q = supabase.from("service_rules").select("*").order("sort_order");
  if (opts.activeOnly !== false) q = q.eq("active", true);
  if (opts.serviceIds && opts.serviceIds.length > 0) q = q.in("service_id", opts.serviceIds);
  const { data, error } = await q.returns<ServiceRuleRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function listPlans(supabase: SupabaseClient): Promise<PlanRow[]> {
  const { data, error } = await supabase.from("plans").select("*").eq("active", true).order("sort_order").returns<PlanRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function listCreditPricingRules(supabase: SupabaseClient): Promise<CreditPricingRuleRow[]> {
  const { data, error } = await supabase.from("credit_pricing_rules").select("*").eq("active", true).returns<CreditPricingRuleRow[]>();
  if (error) throw error;
  return data ?? [];
}

export function localizedName<T extends { name_tr: string; name_en: string }>(row: T, locale: Locale): string {
  return locale === "en" ? row.name_en : row.name_tr;
}

export function localizedDescription<T extends { description_tr: string | null; description_en: string | null }>(row: T, locale: Locale): string | null {
  return locale === "en" ? row.description_en : row.description_tr;
}
