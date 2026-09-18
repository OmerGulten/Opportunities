import "server-only";

import type { WorkspaceContext } from "@/lib/auth/context";
import { toAppError } from "@/lib/errors";
import type { LeadActivityRow, LeadNoteRow, LeadRow, PipelineStageRow } from "@/types/db";

import type { ListLeadsQuery } from "./schemas";

export interface PipelineLead extends LeadRow {
  businessName: string | null;
  city: string | null;
  district: string | null;
  overallScore: number | null;
  primaryServiceKey: string | null;
  websiteStatus: string | null;
}

export interface PipelineColumn {
  stage: PipelineStageRow;
  leads: PipelineLead[];
  count: number;
  estimatedValue: number;
}

export interface PipelineBoard {
  columns: PipelineColumn[];
  totals: {
    leads: number;
    open: number;
    won: number;
    lost: number;
    estimatedValue: number;
    wonValue: number;
    dueFollowUps: number;
  };
  currency: string;
}

/** The whole board in one read: stages plus their leads with business context. */
export async function getPipelineBoard(ctx: WorkspaceContext, query: Partial<ListLeadsQuery> = {}): Promise<PipelineBoard> {
  const [{ data: stages, error: stageError }, leads] = await Promise.all([
    ctx.supabase.from("pipeline_stages").select("*").eq("workspace_id", ctx.workspace.id).order("sort_order").returns<PipelineStageRow[]>(),
    listLeads(ctx, { ...query, limit: query.limit ?? 200 }),
  ]);
  if (stageError) throw toAppError(stageError);

  const byStage = new Map<string, PipelineLead[]>();
  for (const lead of leads.items) {
    const bucket = byStage.get(lead.stage_id);
    if (bucket) bucket.push(lead);
    else byStage.set(lead.stage_id, [lead]);
  }

  const now = Date.now();
  const columns: PipelineColumn[] = (stages ?? []).map((stage) => {
    const stageLeads = byStage.get(stage.id) ?? [];
    return {
      stage,
      leads: stageLeads,
      count: stageLeads.length,
      estimatedValue: stageLeads.reduce((sum, lead) => sum + (lead.estimated_value ?? 0), 0),
    };
  });

  return {
    columns,
    totals: {
      leads: leads.items.length,
      open: leads.items.filter((lead) => lead.status === "open").length,
      won: leads.items.filter((lead) => lead.status === "won").length,
      lost: leads.items.filter((lead) => lead.status === "lost").length,
      estimatedValue: leads.items.reduce((sum, lead) => sum + (lead.estimated_value ?? 0), 0),
      wonValue: leads.items.reduce((sum, lead) => sum + (lead.won_value ?? 0), 0),
      dueFollowUps: leads.items.filter((lead) => lead.next_follow_up_at && new Date(lead.next_follow_up_at).getTime() <= now).length,
    },
    currency: leads.items[0]?.currency ?? "TRY",
  };
}

interface BusinessContext {
  displayName: string | null;
  city: string | null;
  district: string | null;
  overallScore: number | null;
  primaryServiceKey: string | null;
  websiteStatus: string | null;
}

/**
 * Business, opportunity and service context for a set of leads, from the read
 * model. One query for the overview and one for the service keys, regardless of
 * how many leads there are.
 */
async function businessContext(ctx: WorkspaceContext, businessIds: readonly string[]): Promise<Map<string, BusinessContext>> {
  const ids = [...new Set(businessIds)].filter(Boolean);
  const out = new Map<string, BusinessContext>();
  if (ids.length === 0) return out;

  const { data: overview, error } = await ctx.supabase
    .from("business_overview")
    .select("id, display_name, city, district, overall_score, primary_service_id, website_status")
    .in("id", ids)
    .returns<
      Array<{
        id: string;
        display_name: string | null;
        city: string | null;
        district: string | null;
        overall_score: number | null;
        primary_service_id: string | null;
        website_status: string | null;
      }>
    >();
  if (error) throw toAppError(error);

  const serviceIds = [...new Set((overview ?? []).map((row) => row.primary_service_id).filter((id): id is string => Boolean(id)))];
  const serviceKeys = new Map<string, string>();
  if (serviceIds.length > 0) {
    const { data: services } = await ctx.supabase.from("services").select("id, key").in("id", serviceIds).returns<Array<{ id: string; key: string }>>();
    for (const service of services ?? []) serviceKeys.set(service.id, service.key);
  }

  for (const row of overview ?? []) {
    out.set(row.id, {
      displayName: row.display_name,
      city: row.city,
      district: row.district,
      overallScore: row.overall_score,
      primaryServiceKey: row.primary_service_id ? (serviceKeys.get(row.primary_service_id) ?? null) : null,
      websiteStatus: row.website_status,
    });
  }
  return out;
}

export async function listLeads(ctx: WorkspaceContext, query: Partial<ListLeadsQuery> = {}): Promise<{ items: PipelineLead[]; total: number }> {
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;

  // Leads are read plainly and the business context is joined in a second pass.
  // A nested PostgREST embed is not worth the fragility here: `opportunities` is
  // not directly related to `leads` (both hang off `businesses`), and naming a
  // foreign key column as the embed target silently resolves to the wrong table.
  let builder = ctx.supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("workspace_id", ctx.workspace.id)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (query.stageId) builder = builder.eq("stage_id", query.stageId);
  if (query.status) builder = builder.eq("status", query.status);
  if (query.ownerId) builder = builder.eq("owner_id", query.ownerId);
  if (query.dueOnly) builder = builder.lte("next_follow_up_at", new Date().toISOString());

  const { data, error, count } = await builder.returns<LeadRow[]>();
  if (error) throw toAppError(error);

  const leads = data ?? [];
  const context = await businessContext(
    ctx,
    leads.map((lead) => lead.business_id),
  );

  const items: PipelineLead[] = leads.map((lead) => {
    const business = context.get(lead.business_id);
    return {
      ...lead,
      businessName: business?.displayName ?? null,
      city: business?.city ?? null,
      district: business?.district ?? null,
      overallScore: business?.overallScore ?? null,
      primaryServiceKey: business?.primaryServiceKey ?? null,
      websiteStatus: business?.websiteStatus ?? null,
    };
  });

  const filtered = query.q
    ? items.filter((item) => item.businessName?.toLocaleLowerCase(ctx.locale === "en" ? "en" : "tr").includes(query.q!.toLocaleLowerCase(ctx.locale === "en" ? "en" : "tr")))
    : items;

  return { items: filtered, total: count ?? filtered.length };
}

export interface LeadDetail extends PipelineLead {
  notes: LeadNoteRow[];
  activities: LeadActivityRow[];
  stage: PipelineStageRow | null;
}

export async function getLead(ctx: WorkspaceContext, leadId: string): Promise<LeadDetail | null> {
  const { data: lead, error } = await ctx.supabase
    .from("leads")
    .select("*, pipeline_stages(*)")
    .eq("id", leadId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<LeadRow & { pipeline_stages: PipelineStageRow | null }>();
  if (error) throw toAppError(error);
  if (!lead) return null;

  // Business context comes from the read model rather than re-joining by hand.
  const [{ data: overview }, { data: notes }, { data: activities }] = await Promise.all([
    ctx.supabase
      .from("business_overview")
      .select("display_name, city, district, overall_score, primary_service_id, website_status")
      .eq("id", lead.business_id)
      .maybeSingle<{ display_name: string | null; city: string | null; district: string | null; overall_score: number | null; primary_service_id: string | null; website_status: string | null }>(),
    ctx.supabase.from("lead_notes").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).returns<LeadNoteRow[]>(),
    ctx.supabase.from("lead_activities").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(100).returns<LeadActivityRow[]>(),
  ]);

  const serviceKey = overview?.primary_service_id
    ? (
        await ctx.supabase.from("services").select("key").eq("id", overview.primary_service_id).maybeSingle<{ key: string }>()
      ).data?.key ?? null
    : null;

  const { pipeline_stages, ...rest } = lead;
  return {
    ...rest,
    businessName: overview?.display_name ?? null,
    city: overview?.city ?? null,
    district: overview?.district ?? null,
    overallScore: overview?.overall_score ?? null,
    primaryServiceKey: serviceKey,
    websiteStatus: overview?.website_status ?? null,
    stage: pipeline_stages,
    notes: notes ?? [],
    activities: activities ?? [],
  };
}

/** Follow-ups that are due now, for the dashboard reminder list. */
export async function listDueFollowUps(ctx: WorkspaceContext, limit = 10): Promise<PipelineLead[]> {
  const { items } = await listLeads(ctx, { dueOnly: true, limit });
  return items.sort((a, b) => (a.next_follow_up_at ?? "").localeCompare(b.next_follow_up_at ?? ""));
}
