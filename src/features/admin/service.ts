import "server-only";

import { randomUUID } from "node:crypto";

import type { AuthContext } from "@/lib/auth/context";
import { creditKeys, REFERENCE_TYPES } from "@/lib/credits/keys";
import { consumedQuantity } from "@/lib/credits/service";
import { getCreditService } from "@/lib/credits/server";
import { getFeatureFlags, invalidateSettingsCache, setSystemSetting } from "@/lib/db/settings";
import { NotFoundError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreditLedgerRow, ScanJobRow, ServiceRow, ServiceRuleRow, WorkspaceRow } from "@/types/db";

import type { GrantCreditsRequest, ListFailedJobsQuery, ListWorkspacesQuery, ToggleServiceRequest, UpdateFeatureFlagsRequest, UpdatePricingRequest, UpdateServiceRuleRequest } from "./schemas";

/**
 * Platform administration.
 *
 * Every function here assumes the caller already passed `requirePlatformAdmin()`
 * and uses the service-role client, so it deliberately lives in one place that
 * is easy to audit. Credit changes go through the same ledger as everything
 * else, which means an admin adjustment is as traceable as a customer purchase
 * and cannot silently rewrite a balance.
 */

export interface AdminWorkspaceRow {
  workspace: WorkspaceRow;
  memberCount: number;
  credits: { available: number; reserved: number; lifetimeConsumed: number };
  scans: number;
  businesses: number;
  planKey: string | null;
}

export async function listWorkspaces(_ctx: AuthContext, query: ListWorkspacesQuery): Promise<{ items: AdminWorkspaceRow[]; total: number }> {
  const client = createAdminClient();
  let builder = client
    .from("workspaces")
    .select("*, plans(key)", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);
  if (query.q) builder = builder.ilike("name", `%${query.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);

  const { data, error, count } = await builder.returns<Array<WorkspaceRow & { plans: { key: string } | null }>>();
  if (error) throw toAppError(error);

  const items = await Promise.all(
    (data ?? []).map(async (row) => {
      const { plans, ...workspace } = row;
      const [members, account, scans, businesses] = await Promise.all([
        client.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
        client
          .from("credit_accounts")
          .select("balance, reserved, lifetime_consumed")
          .eq("workspace_id", workspace.id)
          .maybeSingle<{ balance: number; reserved: number; lifetime_consumed: number }>(),
        client.from("scans").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
        client.from("businesses").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
      ]);
      return {
        workspace,
        memberCount: members.count ?? 0,
        credits: {
          available: account.data?.balance ?? 0,
          reserved: account.data?.reserved ?? 0,
          lifetimeConsumed: account.data?.lifetime_consumed ?? 0,
        },
        scans: scans.count ?? 0,
        businesses: businesses.count ?? 0,
        planKey: plans?.key ?? null,
      };
    }),
  );

  return { items, total: count ?? items.length };
}

/** Grants or removes credits. Both directions are recorded in the immutable ledger. */
export async function adjustCredits(ctx: AuthContext, request: GrantCreditsRequest): Promise<CreditLedgerRow> {
  const client = createAdminClient();
  const { data: workspace } = await client.from("workspaces").select("id").eq("id", request.workspaceId).maybeSingle<{ id: string }>();
  if (!workspace) throw new NotFoundError("Workspace not found");

  const adjustmentId = randomUUID();
  const service = getCreditService();
  const common = {
    workspaceId: request.workspaceId,
    amount: request.amount,
    referenceType: REFERENCE_TYPES.admin,
    referenceId: adjustmentId,
    idempotencyKey: creditKeys.adminAdjustment(adjustmentId),
    metadata: { reason: request.reason, actor: ctx.user.id },
    actorId: ctx.user.id,
  };

  const entry = request.direction === "debit" ? await service.debit(common) : await service.grant({ ...common, type: "admin_adjustment" });

  logger.info("admin_credit_adjustment", {
    workspaceId: request.workspaceId,
    amount: request.amount,
    direction: request.direction,
    actor: ctx.user.id,
    adjustmentId,
  });
  return entry;
}

export async function updateCreditPricing(ctx: AuthContext, request: UpdatePricingRequest): Promise<void> {
  const client = createAdminClient();
  for (const rule of request.rules) {
    const patch: Record<string, unknown> = { cost: rule.cost, updated_by: ctx.user.id };
    if (rule.active !== undefined) patch.active = rule.active;
    const { error } = await client.from("credit_pricing_rules").update(patch).eq("key", rule.key);
    if (error) throw toAppError(error);
  }
  logger.info("admin_pricing_updated", { actor: ctx.user.id, keys: request.rules.map((rule) => rule.key) });
}

/**
 * Edits a scoring rule. Existing opportunities keep the score they were
 * calculated with (`opportunities.rules_version`); only future scoring uses the
 * new value, so a rule change never silently rewrites history.
 */
export async function updateServiceRule(ctx: AuthContext, request: UpdateServiceRuleRequest): Promise<ServiceRuleRow> {
  const client = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (request.points !== undefined) patch.points = request.points;
  if (request.active !== undefined) patch.active = request.active;
  if (request.minConfidence !== undefined) patch.min_confidence = request.minConfidence;
  if (request.requiresDepth !== undefined) patch.requires_depth = request.requiresDepth;
  if (request.sortOrder !== undefined) patch.sort_order = request.sortOrder;

  const { data: current } = await client.from("service_rules").select("version").eq("id", request.ruleId).maybeSingle<{ version: number }>();
  if (!current) throw new NotFoundError("Rule not found");
  patch.version = current.version + 1;

  const { data, error } = await client.from("service_rules").update(patch).eq("id", request.ruleId).select("*").single<ServiceRuleRow>();
  if (error || !data) throw toAppError(error ?? new Error("Rule could not be updated"));

  logger.info("admin_rule_updated", { actor: ctx.user.id, ruleId: request.ruleId, version: patch.version });
  return data;
}

export async function toggleService(ctx: AuthContext, request: ToggleServiceRequest): Promise<ServiceRow> {
  const client = createAdminClient();
  const { data, error } = await client.from("services").update({ active: request.active }).eq("id", request.serviceId).select("*").single<ServiceRow>();
  if (error || !data) throw toAppError(error ?? new NotFoundError("Service not found"));
  logger.info("admin_service_toggled", { actor: ctx.user.id, serviceId: request.serviceId, active: request.active });
  return data;
}

export async function updateFeatureFlags(ctx: AuthContext, request: UpdateFeatureFlagsRequest): Promise<Record<string, boolean>> {
  const current = await getFeatureFlags();
  const merged = { ...current, ...request.flags };
  await setSystemSetting("features", merged, ctx.user.id, "Platform feature flags");
  invalidateSettingsCache("features");
  logger.info("admin_feature_flags_updated", { actor: ctx.user.id, changed: Object.keys(request.flags) });
  return merged;
}

export interface PlatformUsage {
  workspaces: number;
  users: number;
  scans: { total: number; active: number; failed: number };
  businesses: number;
  opportunities: number;
  providerCalls: { total: number; failed: number; estimatedCost: number };
  aiGenerations: { total: number; failed: number };
  credits: { granted: number; consumed: number; refunded: number };
}

/** Platform-wide counters for the admin overview. */
export async function getPlatformUsage(_ctx: AuthContext, sinceDays = 30): Promise<PlatformUsage> {
  const client = createAdminClient();
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();

  const [workspaces, users, scans, activeScans, failedScans, businesses, opportunities, providerCalls, aiGenerations, ledger] = await Promise.all([
    client.from("workspaces").select("id", { count: "exact", head: true }).is("deleted_at", null),
    client.from("profiles").select("id", { count: "exact", head: true }),
    client.from("scans").select("id", { count: "exact", head: true }),
    client.from("scans").select("id", { count: "exact", head: true }).in("status", ["queued", "discovering", "deduplicating", "enriching", "auditing", "scoring"]),
    client.from("scans").select("id", { count: "exact", head: true }).eq("status", "failed"),
    client.from("businesses").select("id", { count: "exact", head: true }),
    client.from("opportunities").select("id", { count: "exact", head: true }),
    client.from("provider_call_logs").select("success, estimated_cost").gte("created_at", since).returns<Array<{ success: boolean; estimated_cost: number }>>(),
    client.from("message_generations").select("status").gte("created_at", since).returns<Array<{ status: string }>>(),
    client.from("credit_ledger").select("type, amount, metadata").gte("created_at", since).returns<CreditLedgerRow[]>(),
  ]);

  const calls = providerCalls.data ?? [];
  const generations = aiGenerations.data ?? [];
  const entries = ledger.data ?? [];

  return {
    workspaces: workspaces.count ?? 0,
    users: users.count ?? 0,
    scans: { total: scans.count ?? 0, active: activeScans.count ?? 0, failed: failedScans.count ?? 0 },
    businesses: businesses.count ?? 0,
    opportunities: opportunities.count ?? 0,
    providerCalls: {
      total: calls.length,
      failed: calls.filter((call) => !call.success).length,
      estimatedCost: Number(calls.reduce((sum, call) => sum + Number(call.estimated_cost ?? 0), 0).toFixed(4)),
    },
    aiGenerations: { total: generations.length, failed: generations.filter((row) => row.status !== "success").length },
    credits: {
      granted: entries.filter((row) => row.type === "monthly_grant" || row.type === "purchase").reduce((sum, row) => sum + Math.abs(row.amount), 0),
      // Reservation-backed consumption carries amount 0; the quantity is in metadata.
      consumed: entries.filter((row) => row.type === "consumption").reduce((sum, row) => sum + consumedQuantity(row), 0),
      refunded: entries.filter((row) => row.type === "refund").reduce((sum, row) => sum + Math.abs(row.amount), 0),
    },
  };
}

/** Failed workflow jobs, for diagnosing a stuck or partial scan. */
export async function listFailedJobs(_ctx: AuthContext, query: ListFailedJobsQuery): Promise<ScanJobRow[]> {
  const client = createAdminClient();
  let builder = client
    .from("scan_jobs")
    .select("*")
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(query.limit);
  if (query.scanId) builder = builder.eq("scan_id", query.scanId);

  const { data, error } = await builder.returns<ScanJobRow[]>();
  if (error) throw toAppError(error);
  return data ?? [];
}
