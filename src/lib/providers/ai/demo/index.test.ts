import { describe, expect, it } from "vitest";

import type { MessageChannel, MessageLength, Tone } from "@/types/common";

import { verifyMessageAgainstFacts } from "../fact-guard";
import { sampleAnalysisInput, sampleMessageInput } from "../fixtures";
import { CHANNEL_LIMITS, countWords, EMAIL_WORD_RANGES } from "../limits";
import { parseGeneratedMessage, parseOpportunityAnalysis } from "../schemas";
import { composeDemoMessage, createDemoAIProvider } from "./index";

const provider = createDemoAIProvider({ model: "demo-model", latencyMs: 0 });

describe("createDemoAIProvider", () => {
  it("exposes provider metadata", async () => {
    expect(provider.name).toBe("demo");
    expect(provider.isDemo).toBe(true);
    expect(provider.model).toBe("demo-model");
    const result = await provider.generateMessage(sampleMessageInput());
    expect(result.meta).toMatchObject({ provider: "demo", model: "demo-model", inputTokens: null, outputTokens: null, promptVersion: "v1" });
  });

  it("is deterministic", async () => {
    const a = await provider.generateMessage(sampleMessageInput());
    const b = await provider.generateMessage(sampleMessageInput());
    expect(a.output).toEqual(b.output);
  });

  it("composes a Turkish e-mail from the facts", async () => {
    const { output } = await provider.generateMessage(sampleMessageInput());
    expect(output.subject).toBeTruthy();
    expect(output.subject!.length).toBeLessThanOrEqual(80);
    expect(output.body).toContain("Kadıköy Kahve Evi");
    expect(output.body).toContain("4,6 puan");
    expect(output.body).toContain("1.250 yorum");
    expect(output.body).toContain("web sitesi bağlantısı bulunmuyor");
    expect(output.body).toContain("Başlangıç Web Sitesi");
    expect(output.body).toContain("https://app.example.com/report/abc123");
    expect(output.body).toContain("Ayşe Yılmaz");
    expect(output.body).toContain("Marmara Dijital");
    expect(output.usedFacts).toContain("business.rating");
    expect(output.usedFacts).toContain("reportLink");
    expect(output.tone).toBe("friendly_professional");
    expect(output.channel).toBe("email");
    expect(() => parseGeneratedMessage(output)).not.toThrow();
  });

  it("composes English output for the en locale", async () => {
    const { output } = await provider.generateMessage(sampleMessageInput({ locale: "en", tone: "formal" }));
    expect(output.body.startsWith("Dear Kadıköy Kahve Evi team,")).toBe(true);
    expect(output.body).toContain("Kind regards,");
    expect(output.body).toContain("4.6 rating");
    expect(output.subject).toContain("idea for Kadıköy Kahve Evi");
  });

  it("omits rating and review count when they are unknown", async () => {
    const base = sampleMessageInput();
    const { output } = await provider.generateMessage({ ...base, business: { ...base.business, rating: null, reviewCount: null } });
    expect(output.body).not.toContain("puan");
    expect(output.usedFacts).not.toContain("business.rating");
  });

  it("omits the offering and report link when absent", async () => {
    const { output } = await provider.generateMessage(sampleMessageInput({ offering: null, reportLink: null }));
    expect(output.body).not.toContain("paketimiz");
    expect(output.body).not.toContain("http");
  });

  it("respects chat channel limits and has no subject", async () => {
    const whatsapp = await provider.generateMessage(sampleMessageInput({ channel: "whatsapp", length: "long" }));
    expect(whatsapp.output.subject).toBeNull();
    expect(whatsapp.output.body.length).toBeLessThanOrEqual(CHANNEL_LIMITS.whatsapp.maxBodyChars);

    const instagram = await provider.generateMessage(sampleMessageInput({ channel: "instagram_dm", tone: "casual", length: "long" }));
    expect(instagram.output.subject).toBeNull();
    expect(instagram.output.body.length).toBeLessThanOrEqual(CHANNEL_LIMITS.instagram_dm.maxBodyChars);
    expect(instagram.output.body).toContain("https://app.example.com/report/abc123");
  });

  it("stays within the word range for every e-mail length", async () => {
    for (const length of ["short", "medium", "long"] as MessageLength[]) {
      const { output } = await provider.generateMessage(sampleMessageInput({ length }));
      expect(countWords(output.body)).toBeLessThanOrEqual(EMAIL_WORD_RANGES[length].max);
    }
  });

  it("passes the fact guard for every locale, channel, tone and length", () => {
    const channels: MessageChannel[] = ["whatsapp", "email", "instagram_dm"];
    const tones: Tone[] = ["friendly_professional", "formal", "casual", "concise"];
    const lengths: MessageLength[] = ["short", "medium", "long"];
    for (const locale of ["tr", "en"] as const) {
      for (const channel of channels) {
        for (const tone of tones) {
          for (const length of lengths) {
            const input = sampleMessageInput({ locale, channel, tone, length });
            const composed = composeDemoMessage(input);
            const report = verifyMessageAgainstFacts({ ...composed, tone, channel }, input);
            expect(report.violations, `${locale}/${channel}/${tone}/${length}`).toEqual([]);
          }
        }
      }
    }
  });

  it("uses a provided template as the base and signs it", async () => {
    const { output } = await provider.generateMessage(
      sampleMessageInput({ channel: "whatsapp", templateBody: "Merhaba Kadıköy Kahve Evi ekibi, kısa bir gözlemim var.", reportLink: null }),
    );
    expect(output.body.startsWith("Merhaba Kadıköy Kahve Evi ekibi, kısa bir gözlemim var.")).toBe(true);
    expect(output.body).toContain("Ayşe Yılmaz");
    expect(output.usedFacts).toContain("template.body");
  });

  it("falls back to a Google gap or website status when there are no findings", async () => {
    const base = sampleMessageInput();
    const gap = await provider.generateMessage({ ...base, business: { ...base.business, topFindings: [] } });
    expect(gap.output.body).toContain("Çalışma saatleri eksik");
    const website = await provider.generateMessage({ ...base, business: { ...base.business, topFindings: [], googleGaps: [] } });
    expect(website.output.body).toContain("Web sitesi bulunamadı");
  });
});

describe("demo analyzeOpportunity", () => {
  it("returns a grounded analysis with cautions for unchecked items", async () => {
    const { output } = await provider.analyzeOpportunity(sampleAnalysisInput());
    expect(() => parseOpportunityAnalysis(output)).not.toThrow();
    expect(output.summary).toContain("Kadıköy Kahve Evi");
    expect(output.summary).toContain("Web Sitesi Geliştirme");
    expect(output.summary.length).toBeLessThanOrEqual(700);
    expect(output.primaryRecommendation).toMatchObject({ serviceKey: "website_development" });
    expect(output.primaryRecommendation?.rationale).toContain("Profilde web sitesi bağlantısı yok");
    expect(output.talkingPoints.length).toBeLessThanOrEqual(5);
    expect(output.talkingPoints.some((p) => p.includes("4,6"))).toBe(true);
    expect(output.cautions.some((c) => c.includes("Instagram") && c.includes("Kontrol edilmedi"))).toBe(true);
  });

  it("returns no recommendation when scores do not stand out", async () => {
    const input = sampleAnalysisInput({
      services: [
        { serviceKey: "a", serviceLabel: "A", score: 40, reasons: [] },
        { serviceKey: "b", serviceLabel: "B", score: 40, reasons: [] },
      ],
    });
    const { output } = await provider.analyzeOpportunity(input);
    expect(output.primaryRecommendation).toBeNull();
    expect(output.summary).toContain("Hizmet puanı hesaplanamadı");
  });

  it("writes the analysis in English for the en locale", async () => {
    const { output } = await provider.analyzeOpportunity(sampleAnalysisInput({ locale: "en" }));
    expect(output.summary).toContain("was assessed across 2 service areas");
    expect(output.cautions.some((c) => c.startsWith("Instagram status: Not checked"))).toBe(true);
  });
});
