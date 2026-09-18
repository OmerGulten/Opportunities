import "server-only";

import type { WorkspaceContext } from "@/lib/auth/context";
import { toAppError } from "@/lib/errors";
import { isSnapshotExpired, getPolicy } from "@/lib/providers/policy";
import type { ConfidenceLevel, EvidenceType, Json } from "@/types/common";
import type {
  AuditFindingRow,
  BusinessAuditRow,
  BusinessContactRow,
  BusinessProviderSnapshotRow,
  BusinessRow,
  CategoryRow,
  LeadActivityRow,
  LeadRow,
  MessageRow,
  OpportunityRow,
  OpportunityScoreRow,
  OpportunitySignalRow,
  PipelineStageRow,
  PublicReportRow,
  ServiceOfferingRow,
  ServiceRow,
} from "@/types/db";

export interface ScoredService {
  serviceId: string;
  serviceKey: string;
  serviceLabel: string;
  score: number;
  confidence: ConfidenceLevel;
  rawPoints: number;
  maxPoints: number;
  reasons: Array<{ label: string; points: number; evidenceType: EvidenceType; explanation: string }>;
  notChecked: Array<{ ruleKey: string; reason: string }>;
  isPrimary: boolean;
  isSecondary: boolean;
}

export interface RecommendedOffering extends ServiceOfferingRow {
  serviceKey: string;
  serviceLabel: string;
  score: number;
  /** Why this package was suggested. Never a purchase-likelihood claim. */
  reasons: string[];
}

export interface BusinessDetail {
  business: BusinessRow;
  category: CategoryRow | null;
  snapshot: BusinessProviderSnapshotRow | null;
  snapshotStale: boolean;
  contacts: BusinessContactRow[];
  audits: Array<BusinessAuditRow & { findings: AuditFindingRow[] }>;
  signals: OpportunitySignalRow[];
  opportunity: OpportunityRow | null;
  serviceScores: ScoredService[];
  recommendations: RecommendedOffering[];
  lead: (LeadRow & { stage: PipelineStageRow | null }) | null;
  activities: LeadActivityRow[];
  messages: MessageRow[];
  reports: PublicReportRow[];
  benchmark: { metrics: Json; competitors: Json; createdAt: string } | null;
  attribution: { required: boolean; text: string; provider: string };
}

/**
 * Everything the business detail page shows, in one read.
 *
 * Provider data, audit evidence and CRM records stay in separate shapes here
 * exactly as they do in the schema, so the page can label where each fact came
 * from and the provider can be swapped without touching the user's own data.
 */
export async function getBusinessDetail(ctx: WorkspaceContext, businessId: string): Promise<BusinessDetail | null> {
  const { data: business, error } = await ctx.supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<BusinessRow>();
  if (error) throw toAppError(error);
  if (!business) return null;

  const [
    { data: snapshot },
    { data: category },
    { data: contacts },
    { data: audits },
    { data: findings },
    { data: signals },
    { data: opportunity },
    { data: scores },
    { data: services },
    { data: offerings },
    { data: lead },
    { data: activities },
    { data: messages },
    { data: reports },
    { data: benchmark },
  ] = await Promise.all([
    ctx.supabase
      .from("business_provider_snapshots")
      .select("*")
      .eq("business_id", businessId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle<BusinessProviderSnapshotRow>(),
    business.primary_category_id
      ? ctx.supabase.from("categories").select("*").eq("id", business.primary_category_id).maybeSingle<CategoryRow>()
      : Promise.resolve({ data: null }),
    ctx.supabase.from("business_contacts").select("*").eq("business_id", businessId).returns<BusinessContactRow[]>(),
    ctx.supabase.from("business_audits").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).returns<BusinessAuditRow[]>(),
    ctx.supabase.from("audit_findings").select("*").eq("business_id", businessId).order("severity", { ascending: false }).returns<AuditFindingRow[]>(),
    ctx.supabase.from("opportunity_signals").select("*").eq("business_id", businessId).returns<OpportunitySignalRow[]>(),
    ctx.supabase.from("opportunities").select("*").eq("business_id", businessId).maybeSingle<OpportunityRow>(),
    ctx.supabase.from("opportunity_scores").select("*").eq("business_id", businessId).order("score", { ascending: false }).returns<OpportunityScoreRow[]>(),
    ctx.supabase.from("services").select("*").order("sort_order").returns<ServiceRow[]>(),
    ctx.supabase.from("service_offerings").select("*").eq("workspace_id", ctx.workspace.id).eq("enabled", true).order("sort_order").returns<ServiceOfferingRow[]>(),
    ctx.supabase
      .from("leads")
      .select("*, pipeline_stages(*)")
      .eq("workspace_id", ctx.workspace.id)
      .eq("business_id", businessId)
      .maybeSingle<LeadRow & { pipeline_stages: PipelineStageRow | null }>(),
    ctx.supabase
      .from("lead_activities")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<LeadActivityRow[]>(),
    ctx.supabase.from("messages").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(50).returns<MessageRow[]>(),
    ctx.supabase.from("public_reports").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).returns<PublicReportRow[]>(),
    ctx.supabase
      .from("competitor_benchmarks")
      .select("metrics, competitors, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ metrics: Json; competitors: Json; created_at: string }>(),
  ]);

  const serviceById = new Map((services ?? []).map((service) => [service.id, service]));
  const label = (service: ServiceRow | undefined) => (service ? (ctx.locale === "en" ? service.name_en : service.name_tr) : "");
  const secondaryIds = new Set(opportunity?.secondary_service_ids ?? []);

  const serviceScores: ScoredService[] = (scores ?? []).map((score) => {
    const service = serviceById.get(score.service_id);
    const reasons = Array.isArray(score.reasons) ? score.reasons : [];
    const unavailable = Array.isArray(score.unavailable_rules) ? score.unavailable_rules : [];
    return {
      serviceId: score.service_id,
      serviceKey: service?.key ?? score.service_id,
      serviceLabel: label(service),
      score: score.score,
      confidence: score.confidence,
      rawPoints: score.raw_points,
      maxPoints: score.max_points,
      reasons: reasons
        .map((entry) => entry as { name?: string; points?: number; evidenceType?: EvidenceType; explanation?: string })
        .filter((entry) => typeof entry.name === "string")
        .map((entry) => ({
          label: entry.name as string,
          points: Number(entry.points ?? 0),
          evidenceType: (entry.evidenceType ?? "observed") as EvidenceType,
          explanation: entry.explanation ?? "",
        })),
      notChecked: unavailable
        .map((entry) => entry as { ruleKey?: string; reason?: string })
        .map((entry) => ({ ruleKey: String(entry.ruleKey ?? ""), reason: String(entry.reason ?? "") })),
      isPrimary: opportunity?.primary_service_id === score.service_id,
      isSecondary: secondaryIds.has(score.service_id),
    };
  });

  const findingsByAudit = new Map<string, AuditFindingRow[]>();
  for (const finding of findings ?? []) {
    const bucket = findingsByAudit.get(finding.audit_id);
    if (bucket) bucket.push(finding);
    else findingsByAudit.set(finding.audit_id, [finding]);
  }

  const policy = getPolicy(business.provider);
  const { pipeline_stages, ...leadRest } = lead ?? { pipeline_stages: null };

  return {
    business,
    category: category ?? null,
    snapshot: snapshot ?? null,
    // A stale snapshot is shown as stale rather than silently presented as current.
    snapshotStale: snapshot ? isSnapshotExpired(snapshot.expires_at) : false,
    contacts: contacts ?? [],
    audits: (audits ?? []).map((audit) => ({ ...audit, findings: findingsByAudit.get(audit.id) ?? [] })),
    signals: signals ?? [],
    opportunity: opportunity ?? null,
    serviceScores,
    recommendations: recommendOfferings(offerings ?? [], serviceScores, serviceById, label),
    lead: lead ? ({ ...(leadRest as LeadRow), stage: pipeline_stages }) : null,
    activities: activities ?? [],
    messages: messages ?? [],
    reports: reports ?? [],
    benchmark: benchmark ? { metrics: benchmark.metrics, competitors: benchmark.competitors, createdAt: benchmark.created_at } : null,
    attribution: { required: policy.attribution.required, text: policy.attribution.text, provider: business.provider },
  };
}

/**
 * Suggests packages whose service has a real opportunity score.
 *
 * The match is stated as a service fit, never as a likelihood that the business
 * will buy: the reasons are the observed gaps that produced the score.
 */
function recommendOfferings(
  offerings: ServiceOfferingRow[],
  scores: ScoredService[],
  serviceById: Map<string, ServiceRow>,
  label: (service: ServiceRow | undefined) => string,
): RecommendedOffering[] {
  const scoreByService = new Map(scores.map((score) => [score.serviceId, score]));
  return offerings
    .map((offering) => {
      const score = scoreByService.get(offering.service_id);
      if (!score || score.score < 40) return null;
      return {
        ...offering,
        serviceKey: score.serviceKey,
        serviceLabel: label(serviceById.get(offering.service_id)),
        score: score.score,
        reasons: score.reasons.slice(0, 3).map((reason) => reason.label),
      };
    })
    .filter((entry): entry is RecommendedOffering => entry !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
