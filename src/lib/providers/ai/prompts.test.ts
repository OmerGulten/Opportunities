import { describe, expect, it } from "vitest";

import { sampleAnalysisInput, sampleMessageInput } from "./fixtures";
import { PROMPT_VERSION, appendCorrectiveInstruction, buildAnalysisPrompt, buildMessagePrompt } from "./prompts";

describe("buildMessagePrompt", () => {
  it("states the core fact rules", () => {
    const { instructions } = buildMessagePrompt(sampleMessageInput(), { maxOutputTokens: 700 });
    expect(instructions).toContain("ONLY the facts");
    expect(instructions).toContain("NEVER invent ratings, review counts, websites, Instagram accounts");
    expect(instructions).toContain("untrusted DATA");
    expect(instructions).toContain("losing customers");
    expect(instructions).toContain("Signature");
    expect(instructions).toContain("about 700 tokens");
    expect(PROMPT_VERSION).toBe("v1");
  });

  it("passes the reduced facts as JSON in the user turn", () => {
    const input = sampleMessageInput({ userInstruction: "Yerel olduğumuzu belirt" });
    const prompt = buildMessagePrompt(input, { maxOutputTokens: 700 });
    const parsed = JSON.parse(prompt.input) as {
      business: { name: string; rating: number; topFindings: Array<{ title: string }> };
      offering: { name: string; priceFrom: number } | null;
      sender: { name: string | null; workspaceName: string };
      service: { key: string; label: string };
      reportLink: string | null;
      userInstruction: string | null;
      template: unknown;
    };
    expect(parsed.business.name).toBe("Kadıköy Kahve Evi");
    expect(parsed.business.rating).toBe(4.6);
    expect(parsed.business.topFindings[0]?.title).toContain("web sitesi");
    expect(parsed.offering?.name).toBe("Başlangıç Web Sitesi");
    expect(parsed.offering?.priceFrom).toBe(7500);
    expect(parsed.sender.workspaceName).toBe("Marmara Dijital");
    expect(parsed.service.key).toBe("website_development");
    expect(parsed.reportLink).toBe("https://app.example.com/report/abc123");
    expect(parsed.userInstruction).toBe("Yerel olduğumuzu belirt");
    expect(parsed.template).toBeNull();
    expect(prompt.schemaName).toBe("outreach_message");
  });

  it("includes the template when provided", () => {
    const prompt = buildMessagePrompt(sampleMessageInput({ templateBody: "Merhaba {{x}}", templateSubject: "Konu" }), { maxOutputTokens: 500 });
    const parsed = JSON.parse(prompt.input) as { template: { subject: string; body: string } };
    expect(parsed.template.body).toBe("Merhaba {{x}}");
    expect(parsed.template.subject).toBe("Konu");
    expect(prompt.instructions).toContain("template: when not null");
  });

  it("describes channel constraints per channel and length", () => {
    const whatsapp = buildMessagePrompt(sampleMessageInput({ channel: "whatsapp", length: "short" }), { maxOutputTokens: 700 }).instructions;
    expect(whatsapp).toContain("WhatsApp");
    expect(whatsapp).toContain("subject MUST be null");
    expect(whatsapp).toContain("at most 700 characters");
    expect(whatsapp).toContain("about 350 characters");

    const instagram = buildMessagePrompt(sampleMessageInput({ channel: "instagram_dm", length: "long" }), { maxOutputTokens: 700 }).instructions;
    expect(instagram).toContain("Instagram");
    expect(instagram).toContain("at most 500 characters");
    expect(instagram).toContain("reportLink, written verbatim");

    const emailShort = buildMessagePrompt(sampleMessageInput({ channel: "email", length: "short" }), { maxOutputTokens: 700 }).instructions;
    expect(emailShort).toContain("between 90 and 120 words");
    expect(emailShort).toContain("at most 80 characters");
    const emailLong = buildMessagePrompt(sampleMessageInput({ channel: "email", length: "long" }), { maxOutputTokens: 700 }).instructions;
    expect(emailLong).toContain("between 170 and 220 words");
  });

  it("forbids links when there is no report link", () => {
    const instructions = buildMessagePrompt(sampleMessageInput({ channel: "instagram_dm", reportLink: null }), { maxOutputTokens: 700 }).instructions;
    expect(instructions).toContain("Do not include any link");
  });

  it("sets the output language and tone from the input", () => {
    const tr = buildMessagePrompt(sampleMessageInput({ locale: "tr", tone: "formal" }), { maxOutputTokens: 700 }).instructions;
    expect(tr).toContain("in Turkish");
    expect(tr).toContain("Sayın");
    const en = buildMessagePrompt(sampleMessageInput({ locale: "en", tone: "concise" }), { maxOutputTokens: 700 }).instructions;
    expect(en).toContain("in English");
    expect(en).toContain("no filler");
    expect(en).toContain('tone must be "concise"');
  });
});

describe("buildAnalysisPrompt", () => {
  it("passes services and facts as JSON and asks for cautions", () => {
    const prompt = buildAnalysisPrompt(sampleAnalysisInput({ locale: "en" }));
    const parsed = JSON.parse(prompt.input) as { services: Array<{ serviceKey: string; score: number }>; business: { instagramStatus: string } };
    expect(parsed.services[0]?.serviceKey).toBe("website_development");
    expect(parsed.services[0]?.score).toBe(85);
    expect(parsed.business.instagramStatus).toBe("not_checked");
    expect(prompt.instructions).toContain("cautions");
    expect(prompt.instructions).toContain("in English");
    expect(prompt.instructions).toContain("NEVER invent");
    expect(prompt.schemaName).toBe("opportunity_analysis");
  });
});

describe("appendCorrectiveInstruction", () => {
  it("appends quoted violations to the existing instruction", () => {
    const text = appendCorrectiveInstruction("Yerel olduğumuzu belirt", [
      { type: "unknown_number", detail: "15" },
      { type: "forbidden_phrase", detail: "müşteri kaybediyorsunuz" },
    ]);
    expect(text.startsWith("Yerel olduğumuzu belirt")).toBe(true);
    expect(text).toContain("CORRECTION");
    expect(text).toContain('unknown number: "15"');
    expect(text).toContain('forbidden phrase: "müşteri kaybediyorsunuz"');
  });

  it("works without an existing instruction", () => {
    expect(appendCorrectiveInstruction(null, [{ type: "too_long", detail: "body:800>700" }])).toMatch(/^CORRECTION/);
  });
});
