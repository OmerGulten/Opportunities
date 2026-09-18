import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { listCreditPricingRules } from "@/lib/db/reference";
import { createAdminClient } from "@/lib/supabase/admin";

import { buildPricingTable, type PricingTable } from "./pricing";
import { CreditService } from "./service";
import { createSupabaseCreditStore } from "./store.supabase";

let instance: CreditService | null = null;

/**
 * Process-wide CreditService over the service-role client. `credit_apply` is
 * revoked from `authenticated`, so mutations must run here: workflow steps,
 * `/api/internal`, or server code that already verified the caller's workspace
 * membership / platform-admin role and derived `workspaceId` from a trusted row.
 */
export function getCreditService(): CreditService {
  if (!instance) instance = new CreditService(createSupabaseCreditStore(createAdminClient()));
  return instance;
}

/** Pricing table from `credit_pricing_rules` (readable by any authenticated client). */
export async function loadPricingTable(client: SupabaseClient): Promise<PricingTable> {
  return buildPricingTable(await listCreditPricingRules(client));
}
