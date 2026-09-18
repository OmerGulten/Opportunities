import "server-only";

import type { WorkspaceContext } from "@/lib/auth/context";
import { toAppError } from "@/lib/errors";
import type { BusinessOverviewRow, OpportunityScoreRow, PipelineStageRow, ServiceRow } from "@/types/db";

import type { OpportunityFilters } from "./schemas";

export interface OpportunityListItem extends BusinessOverviewRow {
  primaryServiceKey: string | null;
  primaryServiceLabel: string | null;
  stageKey: string | null;
  stageName: string | null;
  /** Score for the service being filtered on, when one was requested. */
  filteredServiceScore: number | null;
}

export interface OpportunityListResult {
  items: OpportunityListItem[];
  total: number;
  /** True when the service-score pre-filter hit its ceiling and results may be incomplete. */
  serviceFilterTruncated: boolean;
}

/** How many business ids the service-score pre-filter will resolve before paging. */
const SERVICE_PREFILTER_LIMIT = 2000;

/**
 * Lists opportunities for the current workspace.
 *
 * Reads go through the `business_overview` view, so Postgres RLS is what keeps
 * workspaces apart — the `workspace_id` filter here is an index hint, not the
 * security boundary.
 *
 * Filtering on a *specific service's* score needs `opportunity_scores`, which
 * the view does not carry. That is resolved as a bounded pre-query whose ids
 * narrow the main query; `serviceFilterTruncated` reports when the bound was
 * reached so the UI can say the list may be incomplete instead of implying it
 * is exhaustive.
 */
export async function listOpportunities(ctx: WorkspaceContext, filters: OpportunityFilters): Promise<OpportunityListResult> {
  const [services, stages] = await Promise.all([loadServices(ctx), loadStages(ctx)]);

  let serviceScoreByBusiness: Map<string, number> | null = null;
  let serviceFilterTruncated = false;

  if (filters.serviceId) {
    const { ids, scores, truncated } = await businessIdsForService(ctx, filters.serviceId, filters.minServiceScore);
    if (ids.length === 0) return { items: [], total: 0, serviceFilterTruncated: truncated };
    serviceScoreByBusiness = scores;
    serviceFilterTruncated = truncated;
  }

  let query = ctx.supabase
    .from("business_overview")
    .select("*", { count: "exact" })
    .eq("workspace_id", ctx.workspace.id);

  if (!filters.includeIgnored) query = query.eq("is_ignored", false);
  if (serviceScoreByBusiness) query = query.in("id", [...serviceScoreByBusiness.keys()]);
  if (filters.q) query = query.ilike("display_name", `%${escapeLike(filters.q)}%`);
  if (filters.categoryId) query = query.eq("primary_category_id", filters.categoryId);
  if (filters.city) query = query.eq("city", filters.city);
  if (filters.district) query = query.eq("district", filters.district);
  if (filters.minScore !== undefined) query = query.gte("overall_score", filters.minScore);
  if (filters.maxScore !== undefined) query = query.lte("overall_score", filters.maxScore);
  if (filters.gaps.length > 0) query = query.contains("digital_gaps", filters.gaps);

  // Explicit statuses only: "not_checked" is a real value and never means "not_found".
  if (filters.website !== "any") query = query.eq("website_status", filters.website);
  if (filters.instagram !== "any") query = query.eq("instagram_status", filters.instagram);

  query = applyPipelineFilter(query, filters.pipeline, stages);
  if (filters.scanId) {
    const ids = await businessIdsForScan(ctx, filters.scanId);
    if (ids.length === 0) return { items: [], total: 0, serviceFilterTruncated };
    query = query.in("id", ids);
  }

  query = applySort(query, filters.sort).range(filters.offset, filters.offset + filters.limit - 1);

  const { data, error, count } = await query.returns<BusinessOverviewRow[]>();
  if (error) throw toAppError(error);

  const serviceById = new Map(services.map((service) => [service.id, service]));
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));

  const items: OpportunityListItem[] = (data ?? []).map((row) => {
    const service = row.primary_service_id ? serviceById.get(row.primary_service_id) : undefined;
    const stage = row.stage_id ? stageById.get(row.stage_id) : undefined;
    return {
      ...row,
      primaryServiceKey: service?.key ?? null,
      primaryServiceLabel: service ? (ctx.locale === "en" ? service.name_en : service.name_tr) : null,
      stageKey: stage?.key ?? null,
      stageName: stage?.name ?? null,
      filteredServiceScore: serviceScoreByBusiness?.get(row.id) ?? null,
    };
  });

  return { items, total: count ?? items.length, serviceFilterTruncated };
}

/** Distinct cities and districts present in the workspace, for the filter menus. */
export async function listOpportunityFacets(ctx: WorkspaceContext): Promise<{ cities: string[]; districts: string[] }> {
  const { data } = await ctx.supabase
    .from("business_overview")
    .select("city, district")
    .eq("workspace_id", ctx.workspace.id)
    .limit(5000)
    .returns<Array<{ city: string | null; district: string | null }>>();

  const cities = new Set<string>();
  const districts = new Set<string>();
  for (const row of data ?? []) {
    if (row.city) cities.add(row.city);
    if (row.district) districts.add(row.district);
  }
  return {
    cities: [...cities].sort((a, b) => a.localeCompare(b, ctx.locale === "en" ? "en" : "tr")),
    districts: [...districts].sort((a, b) => a.localeCompare(b, ctx.locale === "en" ? "en" : "tr")),
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

type OverviewQuery = ReturnType<ReturnType<WorkspaceContext["supabase"]["from"]>["select"]>;

function applySort(query: OverviewQuery, sort: OpportunityFilters["sort"]): OverviewQuery {
  switch (sort) {
    case "score_asc":
      return query.order("overall_score", { ascending: true, nullsFirst: false });
    case "name_asc":
      return query.order("display_name", { ascending: true });
    case "name_desc":
      return query.order("display_name", { ascending: false });
    case "recent":
      return query.order("created_at", { ascending: false });
    case "reviews_desc":
      return query.order("user_rating_count", { ascending: false, nullsFirst: false });
    case "rating_asc":
      return query.order("rating", { ascending: true, nullsFirst: false });
    case "last_contacted":
      return query.order("last_contacted_at", { ascending: false, nullsFirst: false });
    case "score_desc":
    default:
      return query.order("overall_score", { ascending: false, nullsFirst: false });
  }
}

function applyPipelineFilter(query: OverviewQuery, pipeline: OpportunityFilters["pipeline"], stages: PipelineStageRow[]): OverviewQuery {
  switch (pipeline) {
    case "none":
      return query.is("lead_id", null);
    case "in_pipeline":
      return query.not("lead_id", "is", null);
    case "contacted":
      return query.not("last_contacted_at", "is", null);
    case "not_contacted":
      return query.is("last_contacted_at", null);
    case "won": {
      const won = stages.filter((stage) => stage.is_won).map((stage) => stage.id);
      return won.length > 0 ? query.in("stage_id", won) : query.eq("lead_status", "won");
    }
    case "lost": {
      const lost = stages.filter((stage) => stage.is_lost).map((stage) => stage.id);
      return lost.length > 0 ? query.in("stage_id", lost) : query.eq("lead_status", "lost");
    }
    default:
      return query;
  }
}

async function businessIdsForService(
  ctx: WorkspaceContext,
  serviceId: string,
  minScore: number | undefined,
): Promise<{ ids: string[]; scores: Map<string, number>; truncated: boolean }> {
  let query = ctx.supabase
    .from("opportunity_scores")
    .select("business_id, score")
    .eq("workspace_id", ctx.workspace.id)
    .eq("service_id", serviceId)
    .order("score", { ascending: false })
    .limit(SERVICE_PREFILTER_LIMIT);
  if (minScore !== undefined) query = query.gte("score", minScore);

  const { data, error } = await query.returns<Array<Pick<OpportunityScoreRow, "business_id" | "score">>>();
  if (error) throw toAppError(error);

  const scores = new Map((data ?? []).map((row) => [row.business_id, row.score]));
  return { ids: [...scores.keys()], scores, truncated: (data?.length ?? 0) >= SERVICE_PREFILTER_LIMIT };
}

async function businessIdsForScan(ctx: WorkspaceContext, scanId: string): Promise<string[]> {
  const { data, error } = await ctx.supabase
    .from("scan_businesses")
    .select("business_id")
    .eq("scan_id", scanId)
    .eq("workspace_id", ctx.workspace.id)
    .limit(SERVICE_PREFILTER_LIMIT)
    .returns<Array<{ business_id: string }>>();
  if (error) throw toAppError(error);
  return (data ?? []).map((row) => row.business_id);
}

async function loadServices(ctx: WorkspaceContext): Promise<ServiceRow[]> {
  const { data } = await ctx.supabase.from("services").select("*").order("sort_order").returns<ServiceRow[]>();
  return data ?? [];
}

async function loadStages(ctx: WorkspaceContext): Promise<PipelineStageRow[]> {
  const { data } = await ctx.supabase
    .from("pipeline_stages")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("sort_order")
    .returns<PipelineStageRow[]>();
  return data ?? [];
}

/** PostgREST treats % and _ as wildcards in ilike; escape what the user typed. */
function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, (match) => `\\${match}`);
}
