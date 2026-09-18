import { describe, expect, it } from "vitest";

import type { GeneratedMessage } from "@/types/ai";

import { verifyMessageAgainstFacts } from "./fact-guard";
import { sampleMessageInput } from "./fixtures";

function message(body: string, overrides: Partial<GeneratedMessage> = {}): GeneratedMessage {
  return { subject: null, body, usedFacts: [], tone: "friendly_professional", channel: "email", ...overrides };
}

const cleanBody = [
  "Merhaba Kadıköy Kahve Evi ekibi,",
  "Kadıköy bölgesindeki işletmeleri incelerken profilinizde web sitesi bağlantısı görünmediğini fark ettim. Google profilinizde 4,6 puan ve 1.250 yorum bulunuyor.",
  "Başlangıç Web Sitesi paketimiz (₺7.500–₺12.000) tam da bu ihtiyaç için hazırlandı. Rapor: https://app.example.com/report/abc123",
  "Uygun olduğunuz bir zamanda kısa bir görüşme yapmak ister misiniz?",
  "Ayşe Yılmaz\nKurucu, Marmara Dijital",
].join("\n\n");

describe("verifyMessageAgainstFacts", () => {
  it("accepts a message that only uses provided facts", () => {
    const report = verifyMessageAgainstFacts(message(cleanBody, { subject: "Kadıköy Kahve Evi için web sitesi önerisi" }), sampleMessageInput());
    expect(report.violations).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("accepts the rating in either decimal notation and the review count with separators", () => {
    const en = sampleMessageInput({ locale: "en" });
    const body = "Hello Kadıköy Kahve Evi team, your profile shows a 4.6 rating across 1,250 reviews. Ayşe Yılmaz, Marmara Dijital";
    expect(verifyMessageAgainstFacts(message(body), en).ok).toBe(true);
  });

  it("flags numbers that are not in the facts", () => {
    const report = verifyMessageAgainstFacts(message(`${cleanBody}\n\n15 dakikalık bir görüşme öneriyorum.`), sampleMessageInput());
    expect(report.ok).toBe(false);
    expect(report.violations).toContainEqual({ type: "unknown_number", detail: "15" });
  });

  it("allows numbers present in the template or user instruction", () => {
    const input = sampleMessageInput({ templateBody: "15 dakikalık kısa bir görüşme" });
    const report = verifyMessageAgainstFacts(message(`${cleanBody}\n\n15 dakikalık bir görüşme öneriyorum.`), input);
    expect(report.violations.filter((v) => v.type === "unknown_number")).toEqual([]);
  });

  it("allows small numbers, years and score scales", () => {
    const body = `${cleanBody}\n\n2025 yılında 3 adımda ilerleyebiliriz; web sitesi puanı 85/100.`;
    expect(verifyMessageAgainstFacts(message(body), sampleMessageInput()).violations.filter((v) => v.type === "unknown_number")).toEqual([]);
  });

  it("flags percentages and phone-like sequences", () => {
    const report = verifyMessageAgainstFacts(message(`${cleanBody}\n\nZiyaretçilerin %40'ı ayrılıyor. Bize 0532 123 45 67 numarasından ulaşın.`), sampleMessageInput());
    const details = report.violations.filter((v) => v.type === "unknown_number").map((v) => v.detail);
    expect(details).toContain("%40");
    expect(details.some((d) => d.replace(/\D/g, "") === "05321234567")).toBe(true);
  });

  it("flags URLs and e-mail addresses that are not in the facts", () => {
    const report = verifyMessageAgainstFacts(message(`${cleanBody}\n\nÖrneklerimiz: www.rakip-ajans.com ve info@rakip-ajans.com`), sampleMessageInput());
    const urls = report.violations.filter((v) => v.type === "unknown_url").map((v) => v.detail);
    expect(urls).toContain("www.rakip-ajans.com");
    expect(urls).toContain("info@rakip-ajans.com");
  });

  it("accepts the business website and the report link", () => {
    const input = sampleMessageInput({ business: { ...sampleMessageInput().business, websiteUrl: "https://www.kadikoykahve.com/menu" } });
    const body = `${cleanBody}\n\nSiteniz kadikoykahve.com ve rapor https://app.example.com/report/abc123`;
    expect(verifyMessageAgainstFacts(message(body), input).violations.filter((v) => v.type === "unknown_url")).toEqual([]);
  });

  it("flags links other than the report link on Instagram", () => {
    const base = sampleMessageInput({ channel: "instagram_dm", tone: "casual" });
    const input = { ...base, business: { ...base.business, websiteUrl: "https://www.kadikoykahve.com" } };
    const body = "Selam Kadıköy Kahve Evi ekibi, sitenize (kadikoykahve.com) baktım. Rapor: https://app.example.com/report/abc123 — Ayşe, Marmara Dijital";
    const report = verifyMessageAgainstFacts(message(body, { channel: "instagram_dm", tone: "casual" }), input);
    expect(report.violations.some((v) => v.type === "unknown_url" && v.detail.startsWith("link_not_allowed_on_channel:"))).toBe(true);
  });

  it("flags forbidden phrases in Turkish and English", () => {
    const tr = verifyMessageAgainstFacts(message(`${cleanBody}\n\nHer gün müşteri kaybediyorsunuz ve rakipleriniz müşterilerinizi alıyor.`), sampleMessageInput());
    const trDetails = tr.violations.filter((v) => v.type === "forbidden_phrase").map((v) => v.detail);
    expect(trDetails.some((d) => d.includes("kaybed"))).toBe(true);
    expect(trDetails.some((d) => d.includes("rakipleriniz"))).toBe(true);

    const en = verifyMessageAgainstFacts(
      message("Hello Kadıköy Kahve Evi team, you are losing customers every day and competitors are taking them. Ayşe Yılmaz, Marmara Dijital"),
      sampleMessageInput({ locale: "en" }),
    );
    const enDetails = en.violations.filter((v) => v.type === "forbidden_phrase").map((v) => v.detail);
    expect(enDetails).toContain("you are losing");
    expect(enDetails.some((d) => d.startsWith("competitors are taking"))).toBe(true);
  });

  it("flags channel length violations", () => {
    const whatsapp = sampleMessageInput({ channel: "whatsapp" });
    const longBody = `Merhaba Kadıköy Kahve Evi ekibi, ${"gözlem ".repeat(120)} Ayşe Yılmaz, Marmara Dijital`;
    const report = verifyMessageAgainstFacts(message(longBody, { channel: "whatsapp" }), whatsapp);
    expect(report.violations.some((v) => v.type === "too_long" && v.detail.startsWith("body:"))).toBe(true);

    const okReport = verifyMessageAgainstFacts(message("Merhaba Kadıköy Kahve Evi ekibi, kısa mesaj. — Ayşe Yılmaz, Marmara Dijital", { channel: "whatsapp" }), whatsapp);
    expect(okReport.violations.filter((v) => v.type === "too_long")).toEqual([]);
  });

  it("flags e-mail subjects over 80 characters and bodies far above the word range", () => {
    const subjectReport = verifyMessageAgainstFacts(message(cleanBody, { subject: "k".repeat(81) }), sampleMessageInput());
    expect(subjectReport.violations.some((v) => v.type === "too_long" && v.detail.startsWith("subject:"))).toBe(true);

    const words = `Merhaba Kadıköy Kahve Evi ekibi, ${"kelime ".repeat(200)} Ayşe Yılmaz, Marmara Dijital`;
    const wordsReport = verifyMessageAgainstFacts(message(words), sampleMessageInput({ length: "short" }));
    expect(wordsReport.violations.some((v) => v.type === "too_long" && v.detail.startsWith("body_words:"))).toBe(true);
  });

  it("flags a missing signature", () => {
    const report = verifyMessageAgainstFacts(message("Merhaba Kadıköy Kahve Evi ekibi, profilinizde web sitesi bağlantısı görünmüyor. Görüşmek ister misiniz?"), sampleMessageInput());
    expect(report.violations).toContainEqual({ type: "missing_signature", detail: "Ayşe Yılmaz" });
  });

  it("accepts a first-name or workspace-only signature", () => {
    const input = sampleMessageInput();
    expect(verifyMessageAgainstFacts(message("Merhaba Kadıköy Kahve Evi ekibi, kısa bir not. — Ayşe"), input).violations.filter((v) => v.type === "missing_signature")).toEqual([]);
    expect(verifyMessageAgainstFacts(message("Merhaba Kadıköy Kahve Evi ekibi, kısa bir not. — Marmara Dijital"), input).violations.filter((v) => v.type === "missing_signature")).toEqual([]);
  });
});
