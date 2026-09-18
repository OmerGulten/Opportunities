import { describe, expect, it } from "vitest";

import type { OpportunityResult, ServiceScoreResult } from "@/types/scoring";

import { kadikoyRestaurantNoWebsiteSignals, weakWebsiteSeoGapsSignals } from "../../../tests/fixtures/signals";
import { loadDefaultRules } from "./defaults";
import { scoreBusiness } from "./engine";
import { explainServiceScore, summarizeOpportunity } from "./explain";

const { services, rules } = loadDefaultRules();
const serviceIds = services.map((service) => service.id);
const NOW = new Date("2026-09-18T12:00:00.000Z");
const serviceNamesTr = Object.fromEntries(services.map((service) => [service.id, service.nameTr]));
const serviceNamesEn = Object.fromEntries(services.map((service) => [service.id, service.nameEn]));

function serviceScore(result: OpportunityResult, key: string): ServiceScoreResult {
  const found = result.serviceScores.find((score) => score.serviceKey === key);
  if (!found) throw new Error(`missing ${key}`);
  return found;
}

describe("explainServiceScore", () => {
  const tr = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, { locale: "tr", auditDepth: "basic", serviceIds }, NOW);
  const en = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, { locale: "en", auditDepth: "basic", serviceIds }, NOW);

  it("lists matched rules as signed point lines", () => {
    const explanation = explainServiceScore(serviceScore(tr, "website_development"), "tr");
    expect(explanation.lines).toEqual(["+55 Web sitesi bulunamadı", "+10 Görünür eylem çağrısı yok", "+10 İletişim bilgisi yok", "+5 Rezervasyon akışı yok"]);
    expect(explanation.headline).toBe("Skor 80/100 · 80/100 puan · 4 eşleşen kural · güven: yüksek");
  });

  it("explains unavailable rules with a reason, using rule names when provided", () => {
    const reviews = serviceScore(tr, "review_management");
    const bare = explainServiceScore(reviews, "tr");
    expect(bare.unavailableLines).toContain("low_response_rate — değerlendirilemedi: veri alınamadı (30 puan)");
    expect(bare.unavailableLines).toContain("recent_unanswered — değerlendirilemedi: sinyal üretilmedi (20 puan)");

    const named = explainServiceScore(reviews, "en", { low_response_rate: "Low review response rate" });
    expect(named.unavailableLines).toContain("Low review response rate — not evaluated: data unavailable (30 points)");
    expect(named.headline).toBe("Score 10/100 · 10/100 points · 1 matched rules · confidence: high");
  });

  it("marks heuristic evidence and keeps English names for the English result", () => {
    const deep = scoreBusiness(weakWebsiteSeoGapsSignals, rules, services, { locale: "en", auditDepth: "deep", serviceIds }, NOW);
    const seo = explainServiceScore(serviceScore(deep, "seo"), "en");
    expect(seo.lines).toContain("+20 Poor mobile performance (heuristic)");
    expect(seo.lines).toContain("+10 Missing meta description");
    expect(seo.lines.some((line) => line.includes("(heuristic)") && line.includes("Missing H1"))).toBe(false);

    const web = explainServiceScore(serviceScore(en, "website_development"), "en");
    expect(web.lines[0]).toBe("+55 No website found");
    expect(web.unavailableLines.some((line) => line.endsWith("audit depth not reached (10 points)"))).toBe(false);
  });

  it("names the depth gate", () => {
    const discovery = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, { locale: "en", auditDepth: "discovery", serviceIds }, NOW);
    const web = explainServiceScore(serviceScore(discovery, "website_development"), "en");
    expect(web.unavailableLines).toContain("no_cta — not evaluated: audit depth not reached (10 points)");
  });
});

describe("summarizeOpportunity", () => {
  it("writes a neutral summary with primary and secondary services", () => {
    const tr = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, { locale: "tr", auditDepth: "basic", serviceIds }, NOW);
    expect(summarizeOpportunity(tr, serviceNamesTr, "tr")).toBe("Öne çıkan fırsat: Web Sitesi Geliştirme (80/100, güven: yüksek). İkincil fırsatlar: Google İşletme Optimizasyonu.");
    expect(summarizeOpportunity(tr, serviceNamesEn, "en")).toBe("Primary opportunity: Website Development (80/100, confidence: high). Secondary opportunities: Google Business Optimization.");
  });

  it("falls back to gap counts, then to a neutral closing sentence", () => {
    const strict = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, { locale: "en", auditDepth: "basic", serviceIds, secondaryThreshold: 100 }, NOW);
    expect(summarizeOpportunity(strict, serviceNamesEn, "en")).toBe(`Primary opportunity: Website Development (80/100, confidence: high). Observed digital gaps: ${strict.digitalGaps.length}.`);

    const noGaps: OpportunityResult = { ...strict, digitalGaps: [] };
    expect(summarizeOpportunity(noGaps, {}, "en")).toBe("Primary opportunity: website_development (80/100, confidence: high). No other service opportunity was observed above the threshold.");
  });

  it("says so when nothing could be scored", () => {
    const empty = scoreBusiness([], rules, services, { locale: "tr", auditDepth: "basic", serviceIds }, NOW);
    expect(summarizeOpportunity(empty, serviceNamesTr, "tr")).toBe("Değerlendirilebilir sinyal bulunmadığı için fırsat skoru hesaplanamadı.");

    const none = scoreBusiness(kadikoyRestaurantNoWebsiteSignals, rules, services, { locale: "en", auditDepth: "basic", serviceIds: [] }, NOW);
    expect(summarizeOpportunity(none, serviceNamesEn, "en")).toBe("No opportunity score could be calculated because no evaluable signals were available.");
  });
});
