import { describe, expect, it } from "vitest";

import { createFakeFetcher, STRONG_HTML } from "../../../tests/fixtures/html";
import { DETAILS_MASK_BY_DEPTH } from "@/lib/providers/places/field-masks";
import type { PlaceDetails } from "@/types/places";

import { toAuditRows } from "./mappers";
import { runBusinessAudit, type BusinessAuditBundle } from "./run-business-audit";

const SITE = "https://denizrestoran.com/";

const IDS = {
  businessId: "11111111-1111-1111-1111-111111111111",
  workspaceId: "22222222-2222-2222-2222-222222222222",
  scanId: "33333333-3333-3333-3333-333333333333",
  depth: "basic" as const,
};

function details(): PlaceDetails {
  return {
    provider: "google_places",
    providerPlaceId: "places/abc",
    displayName: "Deniz Restoran Kadıköy",
    formattedAddress: "Caferağa Mah. Moda Cad. No:12, Kadıköy",
    location: { lat: 40.98, lng: 29.03 },
    primaryType: "restaurant",
    types: ["restaurant"],
    businessStatus: "OPERATIONAL",
    city: "İstanbul",
    district: "Kadıköy",
    countryCode: "TR",
    rating: 4.6,
    userRatingCount: 148,
    websiteUri: SITE,
    phoneNational: "0216 123 45 67",
    phoneInternational: "+90 216 123 45 67",
    googleMapsUri: "https://maps.google.com/?cid=1",
    openingHours: { weekdayDescriptions: ["Pazartesi: 12:00-23:00"], periodsCount: 7 },
    photoCount: 8,
    priceLevel: null,
    reviewSample: null,
    socialProfiles: null,
    detailLevel: "basic",
    fieldMask: DETAILS_MASK_BY_DEPTH.basic,
    fetchedAt: new Date().toISOString(),
  };
}

async function bundle(): Promise<BusinessAuditBundle> {
  return runBusinessAudit({
    details: details(),
    depth: "basic",
    locale: "tr",
    fetcher: createFakeFetcher({ [SITE]: { body: STRONG_HTML }, "/robots.txt": { status: 404 } }),
    features: { instagramDiscovery: true, performance: false },
  });
}

describe("toAuditRows", () => {
  it("maps one row per outcome, in the same order", async () => {
    const result = toAuditRows(await bundle(), IDS);

    expect(result.audits.map((row) => row.audit_type)).toEqual(["google_business", "website", "performance", "instagram"]);
    for (const row of result.audits) {
      expect(row.business_id).toBe(IDS.businessId);
      expect(row.workspace_id).toBe(IDS.workspaceId);
      expect(row.scan_id).toBe(IDS.scanId);
      expect(row.depth).toBe("basic");
      expect(typeof row.summary).toBe("object");
      expect(row.duration_ms).toBeGreaterThanOrEqual(0);
      expect(Date.parse(row.started_at ?? "")).not.toBeNaN();
    }

    const website = result.audits[1];
    expect(website.status).toBe("completed");
    expect(website.observation).toBe("found");
    expect(website.source).toBe("website");
    expect(website.error_code).toBeNull();
    expect(website.completed_at).not.toBeNull();
    expect((website.summary as { websiteStatus?: string }).websiteStatus).toBe("found");

    const performance = result.audits[2];
    expect(performance.status).toBe("skipped");
    expect(performance.summary).toEqual({});
    expect(performance.completed_at).toBeNull();
  });

  it("binds findings of one outcome to the inserted audit id", async () => {
    const audited = await bundle();
    const result = toAuditRows(audited, IDS);
    const auditId = "44444444-4444-4444-4444-444444444444";

    const websiteFindings = result.findingsFor(1, auditId);
    expect(websiteFindings.length).toBe(audited.outcomes[1].findings.length);
    expect(websiteFindings.length).toBeGreaterThan(0);
    for (const row of websiteFindings) {
      expect(row.audit_id).toBe(auditId);
      expect(row.business_id).toBe(IDS.businessId);
      expect(row.title.length).toBeGreaterThan(0);
      expect(typeof row.evidence).toBe("object");
      expect(Date.parse(row.detected_at)).not.toBeNaN();
    }
    expect(result.findingsFor(99, auditId)).toEqual([]);

    const total = result.audits.flatMap((_row, indexOfRow) => result.findingsFor(indexOfRow, auditId));
    expect(total.length).toBe(audited.findings.length);
  });

  it("maps every merged signal to an upsertable row", async () => {
    const audited = await bundle();
    const result = toAuditRows(audited, IDS);

    const rows = result.signalRows();
    expect(rows.length).toBe(audited.signals.length);
    expect(new Set(rows.map((row) => row.signal_type)).size).toBe(rows.length);
    for (const row of rows) {
      expect(row.business_id).toBe(IDS.businessId);
      expect(row.workspace_id).toBe(IDS.workspaceId);
      expect(row.scan_id).toBe(IDS.scanId);
      expect(row.audit_id).toBeNull();
      expect(row.explanation).not.toBe("");
    }

    const withAudit = result.signalRows({ auditId: "55555555-5555-5555-5555-555555555555" });
    expect(withAudit[0].audit_id).toBe("55555555-5555-5555-5555-555555555555");
  });

  it("defaults the scan id to null", async () => {
    const result = toAuditRows(await bundle(), { businessId: IDS.businessId, workspaceId: IDS.workspaceId, depth: "deep" });
    expect(result.audits[0].scan_id).toBeNull();
    expect(result.audits[0].depth).toBe("deep");
    expect(result.signalRows()[0].scan_id).toBeNull();
  });
});
