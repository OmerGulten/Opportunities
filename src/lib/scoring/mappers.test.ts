import { describe, expect, it } from "vitest";

import type { OpportunitySignalRow, ServiceRow, ServiceRuleRow } from "@/types/db";
import { SIGNAL_TYPES, makeSignal } from "@/types/signals";

import { kadikoyRestaurantNoWebsiteSignals } from "../../../tests/fixtures/signals";
import { loadDefaultRules } from "./defaults";
import { scoreBusiness } from "./engine";
import { ruleFromRow, serviceFromRow, signalFromRow, signalToRow, toOpportunityRow, toOpportunityScoreRows } from "./mappers";

const IDS = { businessId: "b-1", workspaceId: "w-1" };

describe("row mappers", () => {
  it("maps service and rule rows to engine definitions", () => {
    const serviceRow: ServiceRow = {
      id: "s-1",
      key: "seo",
      name_tr: "SEO",
      name_en: "SEO",
      description_tr: null,
      description_en: null,
      icon: "search",
      score_normalizer: 100,
      sort_order: 20,
      active: true,
    };
    expect(serviceFromRow(serviceRow)).toEqual({ id: "s-1", key: "seo", nameTr: "SEO", nameEn: "SEO", scoreNormalizer: 100, sortOrder: 20, active: true });

    const ruleRow: ServiceRuleRow = {
      id: "r-1",
      service_id: "s-1",
      key: "missing_title",
      name_tr: "Başlık etiketi eksik",
      name_en: "Missing title tag",
      explanation_tr: null,
      explanation_en: "The page title tag is missing.",
      signal_type: "website.has_meta_title",
      operator: "is_false",
      value: null,
      points: 10,
      min_confidence: "high",
      requires_depth: "basic",
      active: true,
      sort_order: 20,
      version: 2,
    };
    expect(ruleFromRow(ruleRow)).toEqual({
      id: "r-1",
      serviceId: "s-1",
      key: "missing_title",
      nameTr: "Başlık etiketi eksik",
      nameEn: "Missing title tag",
      explanationTr: null,
      explanationEn: "The page title tag is missing.",
      signalType: "website.has_meta_title",
      operator: "is_false",
      value: null,
      points: 10,
      minConfidence: "high",
      requiresDepth: "basic",
      active: true,
      sortOrder: 20,
      version: 2,
    });
  });

  it("round-trips signals through the opportunity_signals shape", () => {
    const signal = makeSignal(SIGNAL_TYPES.GOOGLE_RATING, 4.6, {
      source: "google_audit",
      confidence: "high",
      explanation: "Average rating shown on the profile.",
      detectedAt: "2026-09-18T09:00:00.000Z",
    });
    const row = signalToRow(signal, { ...IDS, scanId: "scan-1", auditId: "audit-1" });
    expect(row).toEqual({
      business_id: "b-1",
      workspace_id: "w-1",
      scan_id: "scan-1",
      audit_id: "audit-1",
      signal_type: "google.rating",
      source: "google_audit",
      status: "found",
      evidence_type: "observed",
      confidence: "high",
      value: 4.6,
      explanation: "Average rating shown on the profile.",
      detected_at: "2026-09-18T09:00:00.000Z",
    });

    const stored: OpportunitySignalRow = { ...row, id: "sig-1", created_at: "2026-09-18T09:00:01.000Z" };
    expect(signalFromRow(stored)).toEqual(signal);
  });

  it("serialises object values and nulls explanations that are empty", () => {
    const signal = makeSignal("website.meta", { title: "x", tags: ["a"] }, { source: "website_audit", explanation: "   " });
    const row = signalToRow(signal, IDS);
    expect(row.value).toEqual({ title: "x", tags: ["a"] });
    expect(row.explanation).toBeNull();
    expect(row.scan_id).toBeNull();
    expect(row.audit_id).toBeNull();

    const back = signalFromRow({ ...row, id: "sig-2", created_at: row.detected_at });
    expect(back.value).toEqual({ title: "x", tags: ["a"] });
    expect(back.explanation).toBe("");
  });

  it("maps an opportunity result to opportunities and opportunity_scores rows", () => {
    const { services, rules } = loadDefaultRules();
    const result = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, { locale: "tr", auditDepth: "basic", serviceIds: services.map((s) => s.id) }, new Date("2026-09-18T12:00:00.000Z"));

    const opportunity = toOpportunityRow(result, { ...IDS, scanId: "scan-1" });
    expect(opportunity).toEqual({
      business_id: "b-1",
      workspace_id: "w-1",
      scan_id: "scan-1",
      overall_score: result.overallScore,
      primary_service_id: result.primaryServiceId,
      secondary_service_ids: result.secondaryServiceIds,
      confidence: result.confidence,
      status: "calculated",
      digital_gaps: result.digitalGaps,
      rules_version: 1,
      calculated_at: "2026-09-18T12:00:00.000Z",
    });
    // Copies, not shared references.
    expect(opportunity.digital_gaps).not.toBe(result.digitalGaps);

    const scores = toOpportunityScoreRows(result, { ...IDS, opportunityId: "opp-1" });
    expect(scores).toHaveLength(result.serviceScores.length);
    const web = scores.find((row) => row.service_id === result.primaryServiceId);
    expect(web).toMatchObject({ opportunity_id: "opp-1", business_id: "b-1", workspace_id: "w-1", score: 80, raw_points: 80, max_points: 100, confidence: "high" });
    expect(web?.reasons).toHaveLength(4);
    expect(web?.reasons[0]).toMatchObject({ ruleKey: "no_website", points: 55, signalType: "website.status", signalValue: "not_found", evidenceType: "observed" });
    expect(web?.unavailable_rules).toEqual(expect.arrayContaining([expect.objectContaining({ ruleKey: "no_https", reason: "signal_missing", points: 10 })]));
  });
});
