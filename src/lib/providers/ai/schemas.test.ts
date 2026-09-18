import { describe, expect, it } from "vitest";

import { AIInvalidOutputError } from "@/lib/errors";

import {
  generatedMessageSchema,
  opportunityAnalysisSchema,
  parseGeneratedMessage,
  parseOpportunityAnalysis,
  toStrictJsonSchema,
  type JsonSchema,
} from "./schemas";

const validMessage = {
  subject: "Kadıköy Kahve Evi için web sitesi önerisi",
  body: "Merhaba Kadıköy Kahve Evi ekibi, profilinizde web sitesi bağlantısı görünmüyor. Ayşe Yılmaz, Marmara Dijital",
  usedFacts: ["business.name", "business.topFindings[0]"],
  tone: "friendly_professional",
  channel: "email",
};

function walk(node: unknown, visit: (n: Record<string, unknown>) => void) {
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, visit));
    return;
  }
  if (typeof node !== "object" || node === null) return;
  const record = node as Record<string, unknown>;
  visit(record);
  Object.values(record).forEach((v) => walk(v, visit));
}

describe("generatedMessageSchema", () => {
  it("accepts a valid message", () => {
    const parsed = parseGeneratedMessage(validMessage);
    expect(parsed.subject).toBe(validMessage.subject);
    expect(parsed.channel).toBe("email");
  });

  it("accepts a JSON string", () => {
    const parsed = parseGeneratedMessage(JSON.stringify(validMessage));
    expect(parsed.body).toBe(validMessage.body);
  });

  it("accepts null subject", () => {
    expect(parseGeneratedMessage({ ...validMessage, subject: null, channel: "whatsapp" }).subject).toBeNull();
  });

  it("rejects a too-short body with issue details", () => {
    let caught: unknown;
    try {
      parseGeneratedMessage({ ...validMessage, body: "kısa" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AIInvalidOutputError);
    const details = (caught as AIInvalidOutputError).details as { issues: Array<{ path: string }> };
    expect(details.issues.some((i) => i.path === "body")).toBe(true);
    expect((caught as AIInvalidOutputError).code).toBe("ai_invalid_output");
  });

  it("rejects unknown tone and channel", () => {
    expect(() => parseGeneratedMessage({ ...validMessage, tone: "aggressive" })).toThrow(AIInvalidOutputError);
    expect(() => parseGeneratedMessage({ ...validMessage, channel: "sms" })).toThrow(AIInvalidOutputError);
  });

  it("rejects more than 25 used facts and long subjects", () => {
    expect(() => parseGeneratedMessage({ ...validMessage, usedFacts: new Array(26).fill("x") })).toThrow(AIInvalidOutputError);
    expect(() => parseGeneratedMessage({ ...validMessage, subject: "s".repeat(121) })).toThrow(AIInvalidOutputError);
  });

  it("rejects invalid JSON strings", () => {
    expect(() => parseGeneratedMessage("{not json")).toThrow(AIInvalidOutputError);
  });
});

describe("opportunityAnalysisSchema", () => {
  const valid = {
    summary: "Nötr bir özet.",
    primaryRecommendation: { serviceKey: "website_development", rationale: "Profilde web sitesi yok." },
    talkingPoints: ["Web sitesi bağlantısı görünmüyor"],
    cautions: ["Instagram kontrol edilmedi"],
  };

  it("accepts valid analysis and null recommendation", () => {
    expect(parseOpportunityAnalysis(valid).primaryRecommendation?.serviceKey).toBe("website_development");
    expect(parseOpportunityAnalysis({ ...valid, primaryRecommendation: null }).primaryRecommendation).toBeNull();
  });

  it("rejects more than 5 talking points and long summaries", () => {
    expect(() => parseOpportunityAnalysis({ ...valid, talkingPoints: new Array(6).fill("x") })).toThrow(AIInvalidOutputError);
    expect(() => parseOpportunityAnalysis({ ...valid, summary: "s".repeat(701) })).toThrow(AIInvalidOutputError);
  });
});

describe("toStrictJsonSchema", () => {
  it("produces an OpenAI strict-mode compatible schema for messages", () => {
    const schema = toStrictJsonSchema(generatedMessageSchema);
    expect(schema.$schema).toBeUndefined();
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["subject", "body", "usedFacts", "tone", "channel"]);

    const properties = schema.properties as Record<string, JsonSchema>;
    const subject = properties.subject as { anyOf: JsonSchema[] };
    expect(Array.isArray(subject.anyOf)).toBe(true);
    expect(subject.anyOf.some((v) => v.type === "null")).toBe(true);
    expect(subject.anyOf.some((v) => v.type === "string")).toBe(true);

    const tone = properties.tone as { enum: string[] };
    expect(tone.enum).toContain("formal");

    walk(schema, (node) => {
      expect(node.minLength).toBeUndefined();
      expect(node.maxLength).toBeUndefined();
      expect(node.oneOf).toBeUndefined();
      expect(node.default).toBeUndefined();
      if (node.type === "object") {
        expect(node.additionalProperties).toBe(false);
        expect(node.required).toEqual(Object.keys(node.properties as Record<string, unknown>));
      }
    });

    // Length constraints survive as description hints.
    const body = properties.body as { description?: string };
    expect(body.description).toMatch(/at most 2500 characters/);
  });

  it("handles nullable nested objects", () => {
    const schema = toStrictJsonSchema(opportunityAnalysisSchema);
    const properties = schema.properties as Record<string, JsonSchema>;
    const rec = properties.primaryRecommendation as { anyOf: JsonSchema[] };
    const objectVariant = rec.anyOf.find((v) => v.type === "object");
    expect(objectVariant?.additionalProperties).toBe(false);
    expect(objectVariant?.required).toEqual(["serviceKey", "rationale"]);
    expect(rec.anyOf.some((v) => v.type === "null")).toBe(true);
    const points = properties.talkingPoints as { maxItems?: number };
    expect(points.maxItems).toBe(5);
  });
});
