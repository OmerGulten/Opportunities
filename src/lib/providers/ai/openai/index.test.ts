import { beforeEach, describe, expect, it } from "vitest";

import { AIInvalidOutputError, AIUnavailableError, ProviderError } from "@/lib/errors";
import { drainPendingProviderCalls } from "@/lib/providers/call-log";

import { sampleAnalysisInput, sampleMessageInput } from "../fixtures";
import {
  DEFAULT_VISIBLE_TOKENS,
  REASONING_HEADROOM_TOKENS,
  createOpenAIProvider,
  estimateCostUsd,
  isReasoningModel,
  mapOpenAIError,
  type OpenAIResponsesRequest,
  type OpenAIResponsesResult,
} from "./index";

process.env.LOG_LEVEL = "error";

const validOutput = {
  subject: "Kadıköy Kahve Evi için web sitesi önerisi",
  body: "Merhaba Kadıköy Kahve Evi ekibi,\n\nProfilinizde web sitesi bağlantısı görünmüyor.\n\nAyşe Yılmaz\nKurucu, Marmara Dijital",
  usedFacts: ["business.name"],
  tone: "friendly_professional",
  channel: "email",
};

function fakeClient(handler: (request: OpenAIResponsesRequest) => Promise<OpenAIResponsesResult> | OpenAIResponsesResult) {
  const calls: OpenAIResponsesRequest[] = [];
  return {
    calls,
    client: {
      responses: {
        create: async (request: OpenAIResponsesRequest) => {
          calls.push(request);
          return handler(request);
        },
      },
    },
  };
}

class FakeAPIError extends Error {
  status: number;
  headers: Headers;
  constructor(status: number, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.headers = new Headers(headers);
  }
}

describe("createOpenAIProvider", () => {
  beforeEach(() => {
    drainPendingProviderCalls();
  });

  it("parses valid structured output and reports usage", async () => {
    const { client, calls } = fakeClient(() => ({
      output_text: JSON.stringify(validOutput),
      usage: { input_tokens: 1200, output_tokens: 300 },
      status: "completed",
    }));
    const provider = createOpenAIProvider({ apiKey: "sk-test", model: "gpt-5-mini", client });
    expect(provider.name).toBe("openai");
    expect(provider.isDemo).toBe(false);

    const result = await provider.generateMessage(sampleMessageInput());
    expect(result.output.subject).toBe(validOutput.subject);
    expect(result.output.tone).toBe("friendly_professional");
    expect(result.meta).toMatchObject({ provider: "openai", model: "gpt-5-mini", inputTokens: 1200, outputTokens: 300, promptVersion: "v1" });
    expect(result.meta.latencyMs).toBeGreaterThanOrEqual(0);

    const request = calls[0]!;
    expect(request.model).toBe("gpt-5-mini");
    expect(request.temperature).toBeUndefined(); // reasoning model
    // gpt-5-mini reasons before answering and bills that against the ceiling,
    // so the request carries the draft budget plus headroom. See the
    // "output token budget" tests below.
    expect(request.max_output_tokens).toBe(DEFAULT_VISIBLE_TOKENS + REASONING_HEADROOM_TOKENS);
    expect(request.text.format).toMatchObject({ type: "json_schema", name: "outreach_message", strict: true });
    expect(request.text.format.schema.additionalProperties).toBe(false);
    expect(request.instructions).toContain("NEVER invent");
    expect(JSON.parse(request.input)).toMatchObject({ business: { name: "Kadıköy Kahve Evi" } });

    const records = drainPendingProviderCalls();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ providerName: "openai", operation: "generate_message", success: true });
    expect(records[0]!.estimatedCost).toBeGreaterThan(0);
    expect(records[0]!.requestContext).toMatchObject({ inputTokens: 1200, outputTokens: 300, channel: "email" });
  });

  it("passes temperature to non-reasoning models only", async () => {
    const { client, calls } = fakeClient(() => ({ output_text: JSON.stringify(validOutput), usage: { input_tokens: 1, output_tokens: 1 } }));
    const provider = createOpenAIProvider({ apiKey: "sk-test", model: "gpt-4o-mini", temperature: 0.4, client });
    await provider.generateMessage(sampleMessageInput());
    expect(calls[0]!.temperature).toBe(0.4);
    expect(isReasoningModel("gpt-5-mini")).toBe(true);
    expect(isReasoningModel("o4-mini")).toBe(true);
    expect(isReasoningModel("gpt-4.1")).toBe(false);
  });

  it("throws AIInvalidOutputError for invalid JSON", async () => {
    const { client } = fakeClient(() => ({ output_text: "{ not json", usage: { input_tokens: 10, output_tokens: 5 } }));
    const provider = createOpenAIProvider({ apiKey: "sk-test", model: "gpt-5-mini", client });
    await expect(provider.generateMessage(sampleMessageInput())).rejects.toBeInstanceOf(AIInvalidOutputError);
    const records = drainPendingProviderCalls();
    expect(records[0]).toMatchObject({ success: false, errorCode: "ai_invalid_output" });
  });

  it("throws AIInvalidOutputError when the schema is violated", async () => {
    const { client } = fakeClient(() => ({ output_text: JSON.stringify({ ...validOutput, body: "kısa" }) }));
    const provider = createOpenAIProvider({ apiKey: "sk-test", model: "gpt-5-mini", client });
    await expect(provider.generateMessage(sampleMessageInput())).rejects.toBeInstanceOf(AIInvalidOutputError);
  });

  it("throws AIInvalidOutputError when the output was truncated", async () => {
    const { client } = fakeClient(() => ({ output_text: "{\"subject\":", status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }));
    const provider = createOpenAIProvider({ apiKey: "sk-test", model: "gpt-5-mini", client });
    await expect(provider.generateMessage(sampleMessageInput())).rejects.toMatchObject({ code: "ai_invalid_output", details: { reason: "max_output_tokens" } });
  });

  it("maps 429 to a retryable AIUnavailableError with retryAfterMs", async () => {
    const { client } = fakeClient(() => {
      throw new FakeAPIError(429, "Rate limit reached", { "retry-after": "12" });
    });
    const provider = createOpenAIProvider({ apiKey: "sk-test", model: "gpt-5-mini", client });
    let caught: unknown;
    try {
      await provider.generateMessage(sampleMessageInput());
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AIUnavailableError);
    const error = caught as AIUnavailableError;
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBe(12_000);
    expect(drainPendingProviderCalls()[0]).toMatchObject({ success: false, errorCode: "ai_unavailable" });
  });

  it("maps 5xx and timeouts to AIUnavailableError and 401/403 to ProviderError", () => {
    expect(mapOpenAIError(new FakeAPIError(503, "down"))).toBeInstanceOf(AIUnavailableError);
    expect(mapOpenAIError(new FakeAPIError(500, "boom")).retryable).toBe(true);
    const timeout = new Error("timed out");
    timeout.name = "APIConnectionTimeoutError";
    expect(mapOpenAIError(timeout)).toBeInstanceOf(AIUnavailableError);
    expect(mapOpenAIError(new FakeAPIError(401, "bad key"))).toBeInstanceOf(ProviderError);
    expect(mapOpenAIError(new FakeAPIError(403, "forbidden"))).toBeInstanceOf(ProviderError);
    expect(mapOpenAIError(new FakeAPIError(401, "bad key")).retryable).toBe(false);
    expect(mapOpenAIError(new FakeAPIError(400, "bad request")).code).toBe("provider_error");
    expect(mapOpenAIError({ status: 429 }).retryAfterMs).toBe(30_000);
  });

  it("analyzes opportunities with the analysis schema", async () => {
    const analysis = {
      summary: "Nötr özet.",
      primaryRecommendation: { serviceKey: "website_development", rationale: "Profilde web sitesi bağlantısı yok." },
      talkingPoints: ["Web sitesi bağlantısı görünmüyor"],
      cautions: ["Instagram kontrol edilmedi"],
    };
    const { client, calls } = fakeClient(() => ({ output_text: JSON.stringify(analysis), usage: { input_tokens: 500, output_tokens: 120 } }));
    const provider = createOpenAIProvider({ apiKey: "sk-test", model: "gpt-5-mini", client });
    const result = await provider.analyzeOpportunity(sampleAnalysisInput());
    expect(result.output.primaryRecommendation?.serviceKey).toBe("website_development");
    expect(calls[0]!.text.format.name).toBe("opportunity_analysis");
    expect(drainPendingProviderCalls()[0]).toMatchObject({ operation: "analyze_opportunity", success: true });
  });

  it("estimates cost from token usage", () => {
    expect(estimateCostUsd("gpt-5-mini", 1_000_000, 0)).toBeCloseTo(0.25, 6);
    expect(estimateCostUsd("gpt-5-mini", 0, 1_000_000)).toBeCloseTo(2, 6);
    expect(estimateCostUsd("unknown-model", 1_000_000, 1_000_000)).toBeCloseTo(5, 6);
    expect(estimateCostUsd("gpt-5-mini", null, null)).toBe(0);
  });
});

describe("output token budget", () => {
  beforeEach(() => {
    drainPendingProviderCalls();
  });

  /**
   * Regression for a live failure: every draft came back "AI output was cut off
   * before completion". gpt-5-mini spends reasoning tokens before emitting any
   * JSON, and those count against max_output_tokens, so sending the 700-token
   * draft budget as the request ceiling left nothing for the answer.
   */
  it("grants a reasoning model headroom above the draft budget", async () => {
    const { client, calls } = fakeClient(() => ({
      output_text: JSON.stringify(validOutput),
      usage: { input_tokens: 100, output_tokens: 50 },
      status: "completed",
    }));
    const provider = createOpenAIProvider({ apiKey: "sk-test", model: "gpt-5-mini", client });
    await provider.generateMessage(sampleMessageInput());

    expect(calls[0]?.max_output_tokens).toBe(DEFAULT_VISIBLE_TOKENS + REASONING_HEADROOM_TOKENS);
  });

  it("gives a non-reasoning model the draft budget unchanged", async () => {
    const { client, calls } = fakeClient(() => ({
      output_text: JSON.stringify(validOutput),
      usage: { input_tokens: 100, output_tokens: 50 },
      status: "completed",
    }));
    const provider = createOpenAIProvider({ apiKey: "sk-test", model: "gpt-4o-mini", client });
    await provider.generateMessage(sampleMessageInput());

    expect(calls[0]?.max_output_tokens).toBe(DEFAULT_VISIBLE_TOKENS);
  });

  it("keeps asking the model for the draft length, not the inflated ceiling", async () => {
    // The headroom must not leak into the prompt: it would licence a draft five
    // times longer than the channel allows.
    const { client, calls } = fakeClient(() => ({
      output_text: JSON.stringify(validOutput),
      usage: { input_tokens: 100, output_tokens: 50 },
      status: "completed",
    }));
    const provider = createOpenAIProvider({ apiKey: "sk-test", model: "gpt-5-mini", client });
    await provider.generateMessage(sampleMessageInput());

    expect(calls[0]?.instructions).toContain(`${DEFAULT_VISIBLE_TOKENS} tokens`);
    expect(calls[0]?.instructions).not.toContain(`${DEFAULT_VISIBLE_TOKENS + REASONING_HEADROOM_TOKENS} tokens`);
  });

  it("applies headroom on top of a caller-supplied draft budget", async () => {
    const { client, calls } = fakeClient(() => ({
      output_text: JSON.stringify(validOutput),
      usage: { input_tokens: 100, output_tokens: 50 },
      status: "completed",
    }));
    const provider = createOpenAIProvider({ apiKey: "sk-test", model: "gpt-5-mini", maxOutputTokens: 400, client });
    await provider.generateMessage(sampleMessageInput());

    expect(calls[0]?.max_output_tokens).toBe(400 + REASONING_HEADROOM_TOKENS);
    expect(calls[0]?.instructions).toContain("400 tokens");
  });

  it("still reports a truncated response, naming both budgets", async () => {
    const { client } = fakeClient(() => ({ output_text: '{"subject":', status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }));
    const provider = createOpenAIProvider({ apiKey: "sk-test", model: "gpt-5-mini", client });

    await expect(provider.generateMessage(sampleMessageInput())).rejects.toMatchObject({
      code: "ai_invalid_output",
      details: { reason: "max_output_tokens", responseTokens: DEFAULT_VISIBLE_TOKENS + REASONING_HEADROOM_TOKENS, visibleTokens: DEFAULT_VISIBLE_TOKENS },
    });
  });
});
