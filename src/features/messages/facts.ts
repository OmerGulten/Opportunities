import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getT } from "@/lib/i18n";
import type { ConfidenceLevel, Locale } from "@/types/common";
import type { AuditFindingRow, BusinessProviderSnapshotRow, OpportunityRow, OpportunityScoreRow, OpportunitySignalRow, ServiceRow, WorkspaceRow } from "@/types/db";
import type { OfferingFacts, SenderFacts, VerifiedBusinessFacts } from "@/types/ai";

/**
 * Assembles the facts an AI draft is allowed to use.
 *
 * Everything here is read from the database — the provider snapshot, audit
 * findings and computed scores. Nothing is inferred or invented, and unknown
 * values stay absent rather than becoming a default, so the model cannot state
 * something we have not observed. The fact guard later checks the draft against
 * exactly this structure.
 */

export interface BusinessFactsBundle {
  facts: VerifiedBusinessFacts;
  sender: SenderFacts;
  snapshot: BusinessProviderSnapshotRow | null;
  opportunity: OpportunityRow | null;
  mapsUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
}

interface LoadFactsInput {
  supabase: SupabaseClient;
  workspace: WorkspaceRow;
  businessId: string;
  locale: Locale;
  /** Limits the findings passed to the model. */
  maxFindings?: number;
}

export async function loadBusinessFacts(input: LoadFactsInput): Promise<BusinessFactsBundle | null> {
  const { supabase, workspace, businessId, locale } = input;
  const t = getT(locale, "common");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, workspace_id, primary_category_id, categories:primary_category_id(name_tr, name_en)")
    .eq("id", businessId)
    .eq("workspace_id", workspace.id)
    .maybeSingle<{ id: string; workspace_id: string; primary_category_id: string | null; categories: { name_tr: string; name_en: string } | null }>();
  if (!business) return null;

  const [{ data: snapshot }, { data: opportunity }, { data: signals }, { data: findings }] = await Promise.all([
    supabase
      .from("business_provider_snapshots")
      .select("*")
      .eq("business_id", businessId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle<BusinessProviderSnapshotRow>(),
    supabase.from("opportunities").select("*").eq("business_id", businessId).maybeSingle<OpportunityRow>(),
    supabase.from("opportunity_signals").select("*").eq("business_id", businessId).returns<OpportunitySignalRow[]>(),
    supabase
      .from("audit_findings")
      .select("*")
      .eq("business_id", businessId)
      .eq("status", "found")
      .order("severity", { ascending: false })
      .order("detected_at", { ascending: false })
      .limit(input.maxFindings ?? 6)
      .returns<AuditFindingRow[]>(),
  ]);

  const signalsByType = new Map((signals ?? []).map((signal) => [signal.signal_type, signal]));
  const websiteSignal = signalsByType.get("website.status");
  const instagramSignal = signalsByType.get("instagram.status");

  const serviceScores = await loadServiceScores(supabase, businessId, locale);

  const websiteStatusValue = typeof websiteSignal?.value === "string" ? websiteSignal.value : snapshot?.website_uri ? "found" : "not_checked";
  const instagramStatusValue = typeof instagramSignal?.value === "string" ? instagramSignal.value : "not_checked";

  const facts: VerifiedBusinessFacts = {
    businessName: snapshot?.display_name ?? "",
    categoryLabel: locale === "en" ? (business.categories?.name_en ?? null) : (business.categories?.name_tr ?? null),
    district: snapshot?.district ?? null,
    city: snapshot?.city ?? null,
    rating: snapshot?.rating ?? null,
    reviewCount: snapshot?.user_rating_count ?? null,
    websiteStatus: t(`websiteStatus.${websiteStatusValue}`),
    websiteUrl: snapshot?.website_uri ?? null,
    instagramStatus: t(`observation.${instagramStatusValue}`),
    googleGaps: googleGapLabels(signalsByType, locale),
    topFindings: (findings ?? []).map((finding) => ({
      key: finding.key,
      title: finding.title,
      explanation: finding.explanation ?? undefined,
      confidence: finding.confidence as ConfidenceLevel,
    })),
    serviceScores,
  };

  const sender: SenderFacts = {
    senderName: workspace.sender_name,
    senderTitle: workspace.sender_title,
    workspaceName: workspace.name,
    companyDescription: workspace.company_description,
  };

  const instagramUrl = typeof signalsByType.get("instagram.profile_url")?.value === "string" ? (signalsByType.get("instagram.profile_url")!.value as string) : null;

  return {
    facts,
    sender,
    snapshot: snapshot ?? null,
    opportunity: opportunity ?? null,
    mapsUrl: snapshot?.google_maps_uri ?? null,
    websiteUrl: snapshot?.website_uri ?? null,
    instagramUrl,
  };
}

/** Localized short labels for the Google Business gaps we actually observed. */
function googleGapLabels(signals: Map<string, OpportunitySignalRow>, locale: Locale): string[] {
  const t = getT(locale, "findings");
  const labels: string[] = [];
  const push = (key: string, fallbackTr: string, fallbackEn: string) => {
    const translated = t(`${key}.title`);
    labels.push(translated === `${key}.title` ? (locale === "en" ? fallbackEn : fallbackTr) : translated);
  };

  const check = (type: string, predicate: (value: unknown) => boolean, key: string, tr: string, en: string) => {
    const signal = signals.get(type);
    // Only observed facts count: an unchecked signal is not a gap.
    if (!signal || signal.status !== "found") return;
    if (predicate(signal.value)) push(key, tr, en);
  };

  check("google.has_opening_hours", (v) => v === false, "google_missing_hours", "çalışma saatleri eksik", "missing opening hours");
  check("google.has_website", (v) => v === false, "google_missing_website", "web sitesi bağlantısı yok", "no website link");
  check("google.has_phone", (v) => v === false, "google_missing_phone", "telefon numarası yok", "no phone number");
  check("google.photo_count", (v) => typeof v === "number" && v < 5, "google_few_photos", "az sayıda fotoğraf", "few photos");
  check("google.review_count", (v) => typeof v === "number" && v < 10, "google_low_review_count", "az sayıda yorum", "few reviews");
  return labels;
}

async function loadServiceScores(supabase: SupabaseClient, businessId: string, locale: Locale) {
  const { data } = await supabase
    .from("opportunity_scores")
    .select("score, service_id, services(key, name_tr, name_en, sort_order)")
    .eq("business_id", businessId)
    .order("score", { ascending: false })
    .returns<Array<Pick<OpportunityScoreRow, "score" | "service_id"> & { services: Pick<ServiceRow, "key" | "name_tr" | "name_en" | "sort_order"> | null }>>();

  return (data ?? [])
    .filter((row) => row.services)
    .map((row) => ({
      serviceKey: row.services!.key,
      serviceLabel: locale === "en" ? row.services!.name_en : row.services!.name_tr,
      score: row.score,
    }));
}

/** Loads the workspace's offering for a service, used to ground the concrete proposal. */
export async function loadOfferingFacts(supabase: SupabaseClient, workspaceId: string, serviceId: string | null): Promise<OfferingFacts | null> {
  if (!serviceId) return null;
  const { data } = await supabase
    .from("service_offerings")
    .select("name, description, price_from, price_to, currency, billing_period, delivery_time, prompt_context")
    .eq("workspace_id", workspaceId)
    .eq("service_id", serviceId)
    .eq("enabled", true)
    .order("sort_order")
    .limit(1)
    .maybeSingle<{
      name: string;
      description: string | null;
      price_from: number | null;
      price_to: number | null;
      currency: string;
      billing_period: string;
      delivery_time: string | null;
      prompt_context: string | null;
    }>();
  if (!data) return null;
  return {
    name: data.name,
    description: data.description,
    priceFrom: data.price_from,
    priceTo: data.price_to,
    currency: data.currency,
    billingPeriod: data.billing_period,
    deliveryTime: data.delivery_time,
    promptContext: data.prompt_context,
  };
}
