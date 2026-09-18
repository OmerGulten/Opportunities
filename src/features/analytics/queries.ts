import "server-only";

import type { WorkspaceContext } from "@/lib/auth/context";
import { ledgerQuantity } from "@/lib/credits/service";
import { getScanSettings } from "@/lib/db/settings";
import { toAppError } from "@/lib/errors";
import type { Locale } from "@/types/common";
import type { CreditLedgerRow, LeadRow, PipelineStageRow, ServiceRow } from "@/types/db";

/**
 * Dashboard and analytics reads.
 *
 * Aggregates are built from `count` queries and small bounded selects rather
 * than bespoke SQL, so the numbers are easy to verify and RLS still decides what
 * each workspace can see. Everything here is descriptive: counts of what was
 * observed and what the user did. There are no forecasts or predicted values.
 */

export interface ServiceOpportunityCount {
  serviceId: string;
  serviceKey: string;
  serviceLabel: string;
  count: number;
  averageScore: number | null;
}

export interface DashboardSummary {
  businesses: { discovered: number; audited: number; highOpportunity: number };
  scans: { active: number; total: number; lastCompletedAt: string | null };
  credits: { available: number; reserved: number; usedThisMonth: number; grantedThisMonth: number };
  opportunitiesByService: ServiceOpportunityCount[];
  scoreDistribution: Array<{ bucket: string; min: number; max: number; count: number }>;
  pipeline: { total: number; byStage: Array<{ stageKey: string; stageName: string; count: number }>; won: number; lost: number; open: number; wonValue: number; currency: string };
  followUps: { due: number; upcoming: number };
  messages: { generated: number; copied: number; channelsOpened: number };
  isDemo: boolean;
}

export async function getDashboardSummary(ctx: WorkspaceContext): Promise<DashboardSummary> {
  const settings = await getScanSettings();
  const workspaceId = ctx.workspace.id;
  const monthStart = startOfMonth().toISOString();
  const now = new Date();

  const [
    discovered,
    audited,
    highOpportunity,
    activeScans,
    totalScans,
    lastCompleted,
    account,
    services,
    stages,
    leads,
    dueFollowUps,
    upcomingFollowUps,
    generatedMessages,
    copiedMessages,
    openedMessages,
    ledger,
  ] = await Promise.all([
    countRows(ctx, "businesses", (q) => q.eq("workspace_id", workspaceId).eq("is_ignored", false)),
    countRows(ctx, "business_audits", (q) => q.eq("workspace_id", workspaceId).eq("status", "completed")),
    countRows(ctx, "opportunities", (q) => q.eq("workspace_id", workspaceId).gte("overall_score", settings.high_opportunity_threshold)),
    countRows(ctx, "scans", (q) => q.eq("workspace_id", workspaceId).in("status", ["created", "queued", "discovering", "deduplicating", "enriching", "auditing", "scoring"])),
    countRows(ctx, "scans", (q) => q.eq("workspace_id", workspaceId)),
    ctx.supabase
      .from("scans")
      .select("completed_at")
      .eq("workspace_id", workspaceId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ completed_at: string }>(),
    ctx.supabase.from("credit_accounts").select("balance, reserved").eq("workspace_id", workspaceId).maybeSingle<{ balance: number; reserved: number }>(),
    ctx.supabase.from("services").select("*").eq("active", true).order("sort_order").returns<ServiceRow[]>(),
    ctx.supabase.from("pipeline_stages").select("*").eq("workspace_id", workspaceId).order("sort_order").returns<PipelineStageRow[]>(),
    ctx.supabase.from("leads").select("id, stage_id, status, won_value, currency, next_follow_up_at").eq("workspace_id", workspaceId).returns<
      Array<Pick<LeadRow, "id" | "stage_id" | "status" | "won_value" | "currency" | "next_follow_up_at">>
    >(),
    countRows(ctx, "leads", (q) => q.eq("workspace_id", workspaceId).lte("next_follow_up_at", now.toISOString())),
    countRows(ctx, "leads", (q) => q.eq("workspace_id", workspaceId).gt("next_follow_up_at", now.toISOString())),
    countRows(ctx, "message_generations", (q) => q.eq("workspace_id", workspaceId).eq("status", "success")),
    countRows(ctx, "messages", (q) => q.eq("workspace_id", workspaceId).not("copied_at", "is", null)),
    countRows(ctx, "messages", (q) => q.eq("workspace_id", workspaceId).not("channel_opened_at", "is", null)),
    ctx.supabase
      .from("credit_ledger")
      .select("type, amount, metadata")
      .eq("workspace_id", workspaceId)
      .gte("created_at", monthStart)
      .returns<CreditLedgerRow[]>(),
  ]);

  const leadRows = leads.data ?? [];
  const stageRows = stages.data ?? [];
  const serviceRows = services.data ?? [];

  // Consumption served from a reservation has amount 0 (the credits already left
  // the available balance when they were reserved), so the real quantity lives in
  // the entry metadata. Summing amount alone would report zero usage.
  const usedThisMonth = (ledger.data ?? []).filter((row) => row.type === "consumption").reduce((sum, row) => sum + ledgerQuantity(row), 0);
  const grantedThisMonth = (ledger.data ?? [])
    .filter((row) => row.type === "monthly_grant" || row.type === "purchase")
    .reduce((sum, row) => sum + Math.abs(row.amount), 0);

  const [opportunitiesByService, scoreDistribution] = await Promise.all([
    countOpportunitiesByService(ctx, serviceRows, ctx.locale),
    countScoreDistribution(ctx),
  ]);

  return {
    businesses: { discovered, audited, highOpportunity },
    scans: { active: activeScans, total: totalScans, lastCompletedAt: lastCompleted.data?.completed_at ?? null },
    credits: {
      available: account.data?.balance ?? 0,
      reserved: account.data?.reserved ?? 0,
      usedThisMonth,
      grantedThisMonth,
    },
    opportunitiesByService,
    scoreDistribution,
    pipeline: {
      total: leadRows.length,
      byStage: stageRows.map((stage) => ({
        stageKey: stage.key,
        stageName: stage.name,
        count: leadRows.filter((lead) => lead.stage_id === stage.id).length,
      })),
      won: leadRows.filter((lead) => lead.status === "won").length,
      lost: leadRows.filter((lead) => lead.status === "lost").length,
      open: leadRows.filter((lead) => lead.status === "open").length,
      wonValue: leadRows.reduce((sum, lead) => sum + (lead.won_value ?? 0), 0),
      currency: leadRows[0]?.currency ?? "TRY",
    },
    followUps: { due: dueFollowUps, upcoming: upcomingFollowUps },
    messages: { generated: generatedMessages, copied: copiedMessages, channelsOpened: openedMessages },
    isDemo: false,
  };
}

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  scanId?: string;
  serviceId?: string;
  categoryId?: string;
}

export interface AnalyticsResult {
  range: { from: string; to: string };
  scans: { started: number; completed: number; failed: number; cancelled: number; businessesPerScan: number | null };
  discovery: { discovered: number; audited: number; scored: number; failed: number };
  opportunities: { total: number; averageScore: number | null; byService: ServiceOpportunityCount[]; scoreDistribution: Array<{ bucket: string; min: number; max: number; count: number }> };
  gaps: { website: number; social: number; google: number; byGap: Array<{ gap: string; count: number }> };
  outreach: { generated: number; copied: number; channelsOpened: number; contacted: number };
  pipeline: { added: number; meetings: number; proposals: number; won: number; lost: number; wonValue: number; currency: string };
  credits: { consumed: number; granted: number; refunded: number; byDay: Array<{ date: string; consumed: number }> };
}

export async function getAnalytics(ctx: WorkspaceContext, filters: AnalyticsFilters = {}): Promise<AnalyticsResult> {
  const to = filters.to ? new Date(filters.to) : new Date();
  const from = filters.from ? new Date(filters.from) : new Date(to.getTime() - 29 * 86_400_000);
  const workspaceId = ctx.workspace.id;
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const { data: services } = await ctx.supabase.from("services").select("*").eq("active", true).order("sort_order").returns<ServiceRow[]>();
  const serviceRows = services ?? [];

  const [scanRows, opportunityRows, messageRows, leadRows, ledgerRows] = await Promise.all([
    ctx.supabase
      .from("scans")
      .select("id, status, discovered_count, audited_count, scored_count, failed_count, created_at")
      .eq("workspace_id", workspaceId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .returns<Array<{ id: string; status: string; discovered_count: number; audited_count: number; scored_count: number; failed_count: number; created_at: string }>>(),
    ctx.supabase
      .from("opportunities")
      .select("id, overall_score, primary_service_id, digital_gaps, calculated_at, scan_id")
      .eq("workspace_id", workspaceId)
      .gte("calculated_at", fromIso)
      .lte("calculated_at", toIso)
      .returns<Array<{ id: string; overall_score: number; primary_service_id: string | null; digital_gaps: string[]; calculated_at: string; scan_id: string | null }>>(),
    ctx.supabase
      .from("messages")
      .select("id, copied_at, channel_opened_at, created_at")
      .eq("workspace_id", workspaceId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .returns<Array<{ id: string; copied_at: string | null; channel_opened_at: string | null; created_at: string }>>(),
    ctx.supabase
      .from("leads")
      .select("id, status, won_value, currency, created_at, stage_id, pipeline_stages(key)")
      .eq("workspace_id", workspaceId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .returns<Array<{ id: string; status: string; won_value: number | null; currency: string; created_at: string; stage_id: string; pipeline_stages: { key: string } | null }>>(),
    ctx.supabase
      .from("credit_ledger")
      .select("type, amount, metadata, created_at")
      .eq("workspace_id", workspaceId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .returns<CreditLedgerRow[]>(),
  ]);

  const scans = (scanRows.data ?? []).filter((scan) => !filters.scanId || scan.id === filters.scanId);
  const opportunities = (opportunityRows.data ?? []).filter((row) => {
    if (filters.scanId && row.scan_id !== filters.scanId) return false;
    if (filters.serviceId && row.primary_service_id !== filters.serviceId) return false;
    return true;
  });
  const messages = messageRows.data ?? [];
  const leads = leadRows.data ?? [];
  const ledger = ledgerRows.data ?? [];

  const gapCounts = new Map<string, number>();
  for (const opportunity of opportunities) {
    for (const gap of opportunity.digital_gaps ?? []) gapCounts.set(gap, (gapCounts.get(gap) ?? 0) + 1);
  }

  const byService: ServiceOpportunityCount[] = serviceRows.map((service) => {
    const matching = opportunities.filter((row) => row.primary_service_id === service.id);
    return {
      serviceId: service.id,
      serviceKey: service.key,
      serviceLabel: ctx.locale === "en" ? service.name_en : service.name_tr,
      count: matching.length,
      averageScore: matching.length > 0 ? Math.round(matching.reduce((sum, row) => sum + row.overall_score, 0) / matching.length) : null,
    };
  });

  const consumedByDay = new Map<string, number>();
  for (const entry of ledger) {
    if (entry.type !== "consumption") continue;
    const day = entry.created_at.slice(0, 10);
    consumedByDay.set(day, (consumedByDay.get(day) ?? 0) + ledgerQuantity(entry));
  }

  const websiteGaps = countGaps(gapCounts, ["no_website", "weak_website", "no_https", "slow_mobile"]);
  const socialGaps = countGaps(gapCounts, ["no_instagram", "inactive_instagram"]);
  const googleGaps = countGaps(gapCounts, ["google_incomplete", "missing_hours", "few_photos", "low_reviews", "low_rating", "unanswered_reviews"]);

  const completedScans = scans.filter((scan) => scan.status === "completed" || scan.status === "partially_completed");

  return {
    range: { from: fromIso, to: toIso },
    scans: {
      started: scans.length,
      completed: completedScans.length,
      failed: scans.filter((scan) => scan.status === "failed").length,
      cancelled: scans.filter((scan) => scan.status === "cancelled").length,
      businessesPerScan: completedScans.length > 0 ? Math.round(completedScans.reduce((sum, scan) => sum + scan.discovered_count, 0) / completedScans.length) : null,
    },
    discovery: {
      discovered: scans.reduce((sum, scan) => sum + scan.discovered_count, 0),
      audited: scans.reduce((sum, scan) => sum + scan.audited_count, 0),
      scored: scans.reduce((sum, scan) => sum + scan.scored_count, 0),
      failed: scans.reduce((sum, scan) => sum + scan.failed_count, 0),
    },
    opportunities: {
      total: opportunities.length,
      averageScore: opportunities.length > 0 ? Math.round(opportunities.reduce((sum, row) => sum + row.overall_score, 0) / opportunities.length) : null,
      byService,
      scoreDistribution: bucketScores(opportunities.map((row) => row.overall_score)),
    },
    gaps: {
      website: websiteGaps,
      social: socialGaps,
      google: googleGaps,
      byGap: [...gapCounts.entries()].map(([gap, count]) => ({ gap, count })).sort((a, b) => b.count - a.count),
    },
    outreach: {
      generated: messages.length,
      copied: messages.filter((message) => message.copied_at).length,
      channelsOpened: messages.filter((message) => message.channel_opened_at).length,
      contacted: messages.filter((message) => message.copied_at || message.channel_opened_at).length,
    },
    pipeline: {
      added: leads.length,
      meetings: leads.filter((lead) => lead.pipeline_stages?.key === "meeting").length,
      proposals: leads.filter((lead) => lead.pipeline_stages?.key === "proposal").length,
      won: leads.filter((lead) => lead.status === "won").length,
      lost: leads.filter((lead) => lead.status === "lost").length,
      wonValue: leads.reduce((sum, lead) => sum + (lead.won_value ?? 0), 0),
      currency: leads[0]?.currency ?? "TRY",
    },
    credits: {
      consumed: ledger.filter((entry) => entry.type === "consumption").reduce((sum, entry) => sum + ledgerQuantity(entry), 0),
      granted: ledger.filter((entry) => entry.type === "monthly_grant" || entry.type === "purchase").reduce((sum, entry) => sum + Math.abs(entry.amount), 0),
      refunded: ledger.filter((entry) => entry.type === "refund").reduce((sum, entry) => sum + Math.abs(entry.amount), 0),
      byDay: [...consumedByDay.entries()].map(([date, consumed]) => ({ date, consumed })).sort((a, b) => a.date.localeCompare(b.date)),
    },
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

type CountBuilder = ReturnType<ReturnType<WorkspaceContext["supabase"]["from"]>["select"]>;

async function countRows(ctx: WorkspaceContext, table: string, apply: (query: CountBuilder) => CountBuilder): Promise<number> {
  const { count, error } = await apply(ctx.supabase.from(table).select("id", { count: "exact", head: true }));
  if (error) throw toAppError(error);
  return count ?? 0;
}

async function countOpportunitiesByService(ctx: WorkspaceContext, services: ServiceRow[], locale: Locale): Promise<ServiceOpportunityCount[]> {
  const results = await Promise.all(
    services.map(async (service) => {
      const { count } = await ctx.supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ctx.workspace.id)
        .eq("primary_service_id", service.id);
      const { data: scores } = await ctx.supabase
        .from("opportunity_scores")
        .select("score")
        .eq("workspace_id", ctx.workspace.id)
        .eq("service_id", service.id)
        .limit(1000)
        .returns<Array<{ score: number }>>();
      const list = scores ?? [];
      return {
        serviceId: service.id,
        serviceKey: service.key,
        serviceLabel: locale === "en" ? service.name_en : service.name_tr,
        count: count ?? 0,
        averageScore: list.length > 0 ? Math.round(list.reduce((sum, row) => sum + row.score, 0) / list.length) : null,
      };
    }),
  );
  return results;
}

const SCORE_BUCKETS = [
  { bucket: "0-39", min: 0, max: 39 },
  { bucket: "40-59", min: 40, max: 59 },
  { bucket: "60-69", min: 60, max: 69 },
  { bucket: "70-84", min: 70, max: 84 },
  { bucket: "85-100", min: 85, max: 100 },
];

async function countScoreDistribution(ctx: WorkspaceContext) {
  const results = await Promise.all(
    SCORE_BUCKETS.map(async (bucket) => {
      const { count } = await ctx.supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ctx.workspace.id)
        .gte("overall_score", bucket.min)
        .lte("overall_score", bucket.max);
      return { ...bucket, count: count ?? 0 };
    }),
  );
  return results;
}

function bucketScores(scores: number[]) {
  return SCORE_BUCKETS.map((bucket) => ({
    ...bucket,
    count: scores.filter((score) => score >= bucket.min && score <= bucket.max).length,
  }));
}

function countGaps(counts: Map<string, number>, keys: string[]): number {
  return keys.reduce((sum, key) => sum + (counts.get(key) ?? 0), 0);
}

function startOfMonth(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
