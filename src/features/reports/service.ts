import "server-only";

import { recordActivity } from "@/lib/activity";
import type { WorkspaceContext } from "@/lib/auth/context";
import { appUrl } from "@/lib/config/env";
import { creditKeys, REFERENCE_TYPES } from "@/lib/credits/keys";
import { buildPricingTable } from "@/lib/credits/pricing";
import { getCreditService } from "@/lib/credits/server";
import { listCreditPricingRules } from "@/lib/db/reference";
import { getFeatureFlags } from "@/lib/db/settings";
import { FeatureDisabledError, NotFoundError, toAppError } from "@/lib/errors";
import { getT } from "@/lib/i18n";
import { logger } from "@/lib/logging";
import { getPolicy } from "@/lib/providers/policy";
import { generateSecureToken } from "@/lib/security/tokens";
import type { ConfidenceLevel, EvidenceType, Locale, Json } from "@/types/common";
import type {
  AuditFindingRow,
  BusinessProviderSnapshotRow,
  OpportunityRow,
  OpportunityScoreRow,
  OpportunitySignalRow,
  PublicReportRow,
  ServiceOfferingRow,
  ServiceRow,
} from "@/types/db";

import type { CreateReportRequest } from "./schemas";
import { REPORT_SNAPSHOT_VERSION, type ReportBranding, type ReportFinding, type ReportRecommendation, type ReportServiceOpportunity, type ReportSnapshot } from "./types";

export interface CreatedReport {
  report: PublicReportRow;
  url: string;
  creditsConsumed: number;
}

/**
 * Builds a shareable, read-only audit report.
 *
 * The snapshot is assembled from an explicit allow-list (see ./types.ts) and
 * frozen at creation, so a link cannot later expose data the sender never saw
 * and nothing private can leak through a field we forgot to strip.
 */
export async function createReport(ctx: WorkspaceContext, request: CreateReportRequest): Promise<CreatedReport> {
  const flags = await getFeatureFlags();
  if (!flags.public_reports) throw new FeatureDisabledError("public_reports");

  const locale: Locale = request.locale ?? ctx.locale;
  const snapshot = await buildSnapshot(ctx, request.businessId, locale);
  if (!snapshot) throw new NotFoundError("Business not found");

  const token = generateSecureToken(32);
  const expiresInDays = request.expiresInDays ?? 30;
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();

  const { data: report, error } = await ctx.supabase
    .from("public_reports")
    .insert({
      workspace_id: ctx.workspace.id,
      business_id: request.businessId,
      opportunity_id: snapshot.opportunityId,
      token,
      title: request.title?.trim() || snapshot.snapshot.business.name,
      locale,
      content_snapshot: snapshot.snapshot as unknown as Record<string, Json>,
      branding: snapshot.branding as unknown as Record<string, Json>,
      expires_at: expiresAt,
      created_by: ctx.user.id,
    })
    .select("*")
    .single<PublicReportRow>();
  if (error || !report) throw toAppError(error ?? new Error("Report could not be created"));

  const pricing = buildPricingTable(await listCreditPricingRules(ctx.supabase));
  let creditsConsumed = 0;
  if (pricing.report > 0) {
    try {
      await getCreditService().consume({
        workspaceId: ctx.workspace.id,
        amount: pricing.report,
        referenceType: REFERENCE_TYPES.report,
        referenceId: report.id,
        idempotencyKey: creditKeys.report(report.id),
        metadata: { businessId: request.businessId },
        actorId: ctx.user.id,
      });
      creditsConsumed = pricing.report;
    } catch (err) {
      // Every billing failure rolls the report back, not only an insufficient
      // balance. A ledger or database outage used to be logged and stepped over,
      // which left a live, shareable, unpaid report link -- the same free
      // operation as an unpaid draft, with a URL attached. The link must not
      // outlive the charge for it.
      const rollback = await ctx.supabase.from("public_reports").delete().eq("id", report.id);
      if (rollback.error) {
        // The report exists and is unbilled: say so loudly, and still fail the
        // request so the caller never receives a link for it.
        logger.error("report_rollback_failed", { reportId: report.id, error: rollback.error.message });
      }
      throw toAppError(err, "Report could not be billed");
    }
  }

  await recordActivity(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    businessId: request.businessId,
    actorId: ctx.user.id,
    type: "report_created",
    metadata: { reportId: report.id, expiresAt },
  });

  return { report, url: appUrl(`/report/${token}`), creditsConsumed };
}

/** Revokes a link immediately. The row is kept so the audit trail survives. */
export async function revokeReport(ctx: WorkspaceContext, reportId: string): Promise<PublicReportRow> {
  const { data, error } = await ctx.supabase
    .from("public_reports")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("workspace_id", ctx.workspace.id)
    .select("*")
    .single<PublicReportRow>();
  if (error || !data) throw toAppError(error ?? new NotFoundError("Report not found"));

  await recordActivity(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    businessId: data.business_id,
    actorId: ctx.user.id,
    type: "report_revoked",
    metadata: { reportId },
  });
  return data;
}

export async function listReports(ctx: WorkspaceContext, businessId?: string): Promise<PublicReportRow[]> {
  let query = ctx.supabase.from("public_reports").select("*").eq("workspace_id", ctx.workspace.id).order("created_at", { ascending: false });
  if (businessId) query = query.eq("business_id", businessId);
  const { data, error } = await query.returns<PublicReportRow[]>();
  if (error) throw toAppError(error);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// snapshot assembly
// ---------------------------------------------------------------------------

interface SnapshotBundle {
  snapshot: ReportSnapshot;
  branding: ReportBranding;
  opportunityId: string | null;
}

async function buildSnapshot(ctx: WorkspaceContext, businessId: string, locale: Locale): Promise<SnapshotBundle | null> {
  const tCommon = getT(locale, "common");
  const tReports = getT(locale, "reports");

  const { data: business } = await ctx.supabase
    .from("businesses")
    .select("id, provider, categories:primary_category_id(name_tr, name_en)")
    .eq("id", businessId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<{ id: string; provider: string; categories: { name_tr: string; name_en: string } | null }>();
  if (!business) return null;

  const [{ data: snapshotRow }, { data: opportunity }, { data: scores }, { data: findings }, { data: signals }, { data: offerings }, { data: services }] = await Promise.all([
    ctx.supabase
      .from("business_provider_snapshots")
      .select("*")
      .eq("business_id", businessId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle<BusinessProviderSnapshotRow>(),
    ctx.supabase.from("opportunities").select("*").eq("business_id", businessId).maybeSingle<OpportunityRow>(),
    ctx.supabase.from("opportunity_scores").select("*").eq("business_id", businessId).order("score", { ascending: false }).returns<OpportunityScoreRow[]>(),
    ctx.supabase
      .from("audit_findings")
      .select("*")
      .eq("business_id", businessId)
      .eq("status", "found")
      .order("severity", { ascending: false })
      .limit(12)
      .returns<AuditFindingRow[]>(),
    ctx.supabase.from("opportunity_signals").select("*").eq("business_id", businessId).returns<OpportunitySignalRow[]>(),
    ctx.supabase.from("service_offerings").select("*").eq("workspace_id", ctx.workspace.id).eq("enabled", true).order("sort_order").returns<ServiceOfferingRow[]>(),
    ctx.supabase.from("services").select("*").returns<ServiceRow[]>(),
  ]);

  const serviceById = new Map((services ?? []).map((service) => [service.id, service]));
  const label = (service: ServiceRow | undefined) => (service ? (locale === "en" ? service.name_en : service.name_tr) : "");
  const signalValue = (type: string) => (signals ?? []).find((signal) => signal.signal_type === type);

  const websiteSignal = signalValue("website.status");
  const instagramSignal = signalValue("instagram.status");

  const serviceOpportunities: ReportServiceOpportunity[] = (scores ?? []).map((score) => {
    const service = serviceById.get(score.service_id);
    const reasons = Array.isArray(score.reasons) ? score.reasons : [];
    const unavailable = Array.isArray(score.unavailable_rules) ? score.unavailable_rules : [];
    return {
      serviceKey: service?.key ?? score.service_id,
      serviceLabel: label(service),
      score: score.score,
      confidence: score.confidence,
      // Rule names and points only: the rule definitions themselves stay internal.
      reasons: reasons
        .map((reason) => reason as { name?: string; points?: number; evidenceType?: EvidenceType })
        .filter((reason) => typeof reason.name === "string")
        .map((reason) => ({ label: reason.name as string, points: Number(reason.points ?? 0), evidenceType: (reason.evidenceType ?? "observed") as EvidenceType })),
      notChecked: unavailable
        .map((rule) => rule as { ruleKey?: string; reason?: string })
        .filter((rule) => rule.reason === "not_checked" || rule.reason === "unavailable" || rule.reason === "depth_not_reached")
        .map((rule) => String(rule.ruleKey ?? "")),
    };
  });

  const primaryService = opportunity?.primary_service_id ? serviceById.get(opportunity.primary_service_id) : undefined;

  const recommendations: ReportRecommendation[] = (offerings ?? [])
    .filter((offering) => serviceOpportunities.some((item) => item.serviceKey === serviceById.get(offering.service_id)?.key && item.score >= 40))
    .slice(0, 4)
    .map((offering) => {
      const service = serviceById.get(offering.service_id);
      return {
        serviceKey: service?.key ?? offering.service_id,
        serviceLabel: label(service),
        offeringName: offering.name,
        description: offering.description,
        priceFrom: offering.price_from,
        priceTo: offering.price_to,
        currency: offering.currency,
        billingPeriod: offering.billing_period,
        deliveryTime: offering.delivery_time,
      };
    });

  const reportFindings: ReportFinding[] = (findings ?? []).map((finding) => ({
    key: finding.key,
    title: finding.title,
    explanation: finding.explanation,
    whyItMatters: finding.why_it_matters,
    severity: finding.severity,
    status: finding.status,
    evidenceType: finding.evidence_type,
    confidence: finding.confidence,
  }));

  const policy = getPolicy(business.provider);

  const snapshot: ReportSnapshot = {
    version: REPORT_SNAPSHOT_VERSION,
    locale,
    generatedAt: new Date().toISOString(),
    business: {
      name: snapshotRow?.display_name ?? "",
      categoryLabel: locale === "en" ? (business.categories?.name_en ?? null) : (business.categories?.name_tr ?? null),
      city: snapshotRow?.city ?? null,
      district: snapshotRow?.district ?? null,
      address: snapshotRow?.formatted_address ?? null,
      rating: snapshotRow?.rating ?? null,
      reviewCount: snapshotRow?.user_rating_count ?? null,
      websiteStatus: typeof websiteSignal?.value === "string" ? websiteSignal.value : "not_checked",
      websiteUrl: snapshotRow?.website_uri ?? null,
      instagramStatus: typeof instagramSignal?.value === "string" ? instagramSignal.value : "not_checked",
      mapsUrl: snapshotRow?.google_maps_uri ?? null,
    },
    summary: {
      overallScore: opportunity?.overall_score ?? null,
      primaryServiceKey: primaryService?.key ?? null,
      primaryServiceLabel: label(primaryService),
      confidence: (opportunity?.confidence ?? null) as ConfidenceLevel | null,
      digitalGaps: opportunity?.digital_gaps ?? [],
      headline: tReports("snapshot.headline", {
        business: snapshotRow?.display_name ?? "",
        count: String(reportFindings.length),
        service: label(primaryService),
      }),
    },
    findings: reportFindings,
    serviceOpportunities,
    recommendations,
    callToAction: {
      heading: tReports("snapshot.ctaHeading"),
      body: tReports("snapshot.ctaBody", { workspace: ctx.workspace.name }),
    },
    attribution: {
      provider: business.provider,
      required: policy.attribution.required,
      text: policy.attribution.text || tCommon("attribution.poweredBy"),
    },
    disclaimer: tReports("snapshot.disclaimer"),
  };

  const branding: ReportBranding = {
    workspaceName: ctx.workspace.name,
    logoUrl: ctx.workspace.logo_url,
    primaryColor: ctx.workspace.brand_primary_color,
    senderName: ctx.workspace.sender_name,
    senderTitle: ctx.workspace.sender_title,
    contactEmail: ctx.workspace.sender_email,
    contactPhone: ctx.workspace.sender_phone,
    companyWebsite: ctx.workspace.company_website,
  };

  return { snapshot, branding, opportunityId: opportunity?.id ?? null };
}
