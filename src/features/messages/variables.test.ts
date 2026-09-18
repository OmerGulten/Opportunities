import { describe, expect, it } from "vitest";

import { sampleMessageInput } from "@/lib/providers/ai/fixtures";

import {
  MESSAGE_VARIABLES,
  MESSAGE_VARIABLE_KEYS,
  buildVariableContext,
  extractVariables,
  resolveTemplate,
  validateTemplateBody,
} from "./variables";

describe("MESSAGE_VARIABLES", () => {
  it("lists every documented variable with a description key and example", () => {
    const expected = [
      "business_name",
      "district",
      "city",
      "rating",
      "review_count",
      "website_status",
      "instagram_status",
      "primary_service",
      "opportunity_score",
      "top_finding",
      "report_link",
      "sender_name",
      "sender_title",
      "workspace_name",
      "category",
      "google_maps_url",
      "offering_name",
      "offering_price_range",
    ];
    expect([...MESSAGE_VARIABLE_KEYS].sort()).toEqual([...expected].sort());
    for (const v of MESSAGE_VARIABLES) {
      expect(v.descriptionKey).toBe(`variables.${v.key}`);
      expect(v.example.length).toBeGreaterThan(0);
    }
  });
});

describe("buildVariableContext", () => {
  it("builds localized values from facts", () => {
    const input = sampleMessageInput();
    const ctx = buildVariableContext({
      facts: input.business,
      sender: input.sender,
      offering: input.offering,
      reportLink: input.reportLink,
      mapsUrl: "https://maps.google.com/?cid=1",
      locale: "tr",
    });
    expect(ctx.business_name).toBe("Kadıköy Kahve Evi");
    expect(ctx.rating).toBe("4,6");
    expect(ctx.review_count).toBe("1.250");
    expect(ctx.website_status).toBe("Web sitesi bulunamadı");
    expect(ctx.instagram_status).toBe("Kontrol edilmedi");
    expect(ctx.primary_service).toBe("Web Sitesi Geliştirme");
    expect(ctx.opportunity_score).toBe("85");
    expect(ctx.top_finding).toContain("web sitesi bağlantısı bulunmuyor");
    expect(ctx.report_link).toBe("https://app.example.com/report/abc123");
    expect(ctx.google_maps_url).toBe("https://maps.google.com/?cid=1");
    expect(ctx.offering_name).toBe("Başlangıç Web Sitesi");
    expect(ctx.offering_price_range).toContain("7.500");
    expect(ctx.offering_price_range).toContain("12.000");
    expect(ctx.category).toBe("Kafe");
    expect(Object.keys(ctx).sort()).toEqual([...MESSAGE_VARIABLE_KEYS].sort());
  });

  it("uses English formatting and labels for en", () => {
    const input = sampleMessageInput();
    const ctx = buildVariableContext({ facts: input.business, sender: input.sender, locale: "en" });
    expect(ctx.rating).toBe("4.6");
    expect(ctx.review_count).toBe("1,250");
    expect(ctx.website_status).toBe("No website found");
    expect(ctx.instagram_status).toBe("Not checked");
    expect(ctx.offering_name).toBeNull();
    expect(ctx.offering_price_range).toBeNull();
  });

  it("returns null for unknown facts instead of placeholders", () => {
    const input = sampleMessageInput();
    const ctx = buildVariableContext({
      facts: { ...input.business, rating: null, reviewCount: null, district: null, topFindings: [], serviceScores: [] },
      sender: { ...input.sender, senderName: null, senderTitle: null },
      locale: "tr",
    });
    expect(ctx.rating).toBeNull();
    expect(ctx.review_count).toBeNull();
    expect(ctx.district).toBeNull();
    expect(ctx.top_finding).toBeNull();
    expect(ctx.primary_service).toBeNull();
    expect(ctx.opportunity_score).toBeNull();
    expect(ctx.sender_name).toBeNull();
    expect(Object.values(ctx).every((v) => v !== "undefined" && v !== "null")).toBe(true);
  });

  it("prefers explicit primary service and score when given", () => {
    const input = sampleMessageInput();
    const ctx = buildVariableContext({ facts: input.business, sender: input.sender, primaryService: "SEO", opportunityScore: 71.6, locale: "tr" });
    expect(ctx.primary_service).toBe("SEO");
    expect(ctx.opportunity_score).toBe("72");
  });
});

describe("resolveTemplate", () => {
  const context = {
    business_name: "Kadıköy Kahve Evi",
    district: null,
    city: "İstanbul",
    rating: "4,6",
    review_count: 1250,
    report_link: null,
    sender_name: "Ayşe Yılmaz",
    workspace_name: "Marmara Dijital",
  };

  it("substitutes known variables including numbers", () => {
    const result = resolveTemplate("{{business_name}}: {{rating}} puan, {{ review_count }} yorum", context);
    expect(result.text).toBe("Kadıköy Kahve Evi: 4,6 puan, 1250 yorum");
    expect(result.used).toEqual(["business_name", "rating", "review_count"]);
    expect(result.missing).toEqual([]);
  });

  it("removes missing variables without leaving artifacts", () => {
    const template = [
      "Merhaba {{business_name}} ekibi ({{district}}),",
      "",
      "{{district}}, {{city}} bölgesindeki işletmeleri incelerken profilinizi gördük.",
      "Kısa bir rapor paylaşabilirim: {{report_link}}",
      "{{report_link}}",
      "",
      "{{sender_name}}",
      "{{sender_title}}",
      "{{workspace_name}}",
    ].join("\n");
    const result = resolveTemplate(template, context);
    expect(result.text).toBe(
      [
        "Merhaba Kadıköy Kahve Evi ekibi,",
        "",
        "İstanbul bölgesindeki işletmeleri incelerken profilinizi gördük.",
        "Kısa bir rapor paylaşabilirim.",
        "",
        "Ayşe Yılmaz",
        "Marmara Dijital",
      ].join("\n"),
    );
    expect(result.text).not.toMatch(/undefined|null/);
    expect(result.text).not.toMatch(/ {2}/);
    expect(result.text).not.toMatch(/ ,/);
    expect(result.text).not.toMatch(/\n{3}/);
    expect(result.missing).toEqual(["district", "report_link", "sender_title"]);
    expect(result.used).toEqual(["business_name", "city", "sender_name", "workspace_name"]);
  });

  it("removes a trailing connector before a missing value", () => {
    expect(resolveTemplate("{{city}}, {{district}}.", context).text).toBe("İstanbul.");
    expect(resolveTemplate("{{city}} - {{district}}", context).text).toBe("İstanbul");
  });

  it("never renders undefined or null for unknown variables", () => {
    const result = resolveTemplate("Merhaba {{nonexistent}} {{business_name}} {{undefined_var}}!", context);
    expect(result.text).toBe("Merhaba Kadıköy Kahve Evi!");
    expect(result.missing).toEqual(["nonexistent", "undefined_var"]);
  });

  it("keeps unknown placeholders when asked", () => {
    const result = resolveTemplate("{{business_name}} {{custom}} {{district}}", context, { unknown: "keep" });
    expect(result.text).toBe("Kadıköy Kahve Evi {{custom}}");
    expect(result.missing).toEqual(["custom", "district"]);
  });

  it("treats empty strings as missing", () => {
    expect(resolveTemplate("A {{x}} B", { x: "   " }).text).toBe("A B");
  });

  it("preserves intentional blank lines", () => {
    expect(resolveTemplate("Satır 1\n\nSatır 2", context).text).toBe("Satır 1\n\nSatır 2");
  });
});

describe("extractVariables / validateTemplateBody", () => {
  it("extracts unique variables in order", () => {
    expect(extractVariables("{{a}} {{ b }} {{a}} {{c.d}}")).toEqual(["a", "b", "c.d"]);
    expect(extractVariables("no vars")).toEqual([]);
  });

  it("validates against the known variable list", () => {
    expect(validateTemplateBody("Merhaba {{business_name}}, {{rating}} puan")).toEqual({ ok: true, unknownVariables: [] });
    expect(validateTemplateBody("Merhaba {{owner_name}} {{business_name}} {{phone}}")).toEqual({ ok: false, unknownVariables: ["owner_name", "phone"] });
  });
});
