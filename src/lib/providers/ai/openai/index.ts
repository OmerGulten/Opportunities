import OpenAI from "openai";

import { AIInvalidOutputError, AIUnavailableError, AppError, ProviderError, isAppError } from "@/lib/errors";
import { timedProviderCall, type ProviderCallRecord } from "@/lib/providers/call-log";
import type {
  AIGenerationMeta,
  AIProvider,
  AIResult,
  AnalyzeOpportunityInput,
  GenerateMessageInput,
  GeneratedMessage,
  OpportunityAnalysis,
} from "@/types/ai";
import type { Json } from "@/types/common";

import { PROMPT_VERSION, buildAnalysisPrompt, buildMessagePrompt, type BuiltPrompt } from "../prompts";
import {
  generatedMessageSchema,
  opportunityAnalysisSchema,
  parseGeneratedMessage,
  parseOpportunityAnalysis,
  toStrictJsonSchema,
  type JsonSchema,
} from "../schemas";

/**
 * OpenAI Responses API provider with strict structured outputs.
 *
 * The client surface is reduced to what this module uses so tests can inject a
 * plain object; the real `OpenAI` instance satisfies it structurally.
 */
export interface OpenAIResponsesRequest {
  model: string;
  instructions: string;
  input: string;
  max_output_tokens: number;
  temperature?: number;
  text: { format: { type: "json_schema"; name: string; schema: JsonSchema; strict: true } };
}

export interface OpenAIResponsesResult {
  output_text?: string;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: unknown;
}

export interface OpenAIResponsesClient {
  responses: {
    create(request: OpenAIResponsesRequest, options?: { timeout?: number; signal?: AbortSignal }): Promise<OpenAIResponsesResult>;
  };
}

export interface OpenAIProviderOptions {
  apiKey: string;
  model: string;
  /** Default 700; matches AISettings.max_output_tokens. */
  maxOutputTokens?: number;
  /** Default 0.7; ignored for reasoning models (see isReasoningModel). */
  temperature?: number;
  /** Inject a fake client in tests. */
  client?: OpenAIResponsesClient;
  /** Per-request timeout, default 45s. */
  timeoutMs?: number;
  /** SDK-level retries for transport errors, default 1. 429/5xx are surfaced as retryable errors instead. */
  maxRetries?: number;
}

/**
 * Reasoning models (gpt-5 family, o-series) reject the `temperature`
 * parameter; sending it fails the request with a 400. Sampling parameters
 * are therefore only passed to non-reasoning models.
 */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model);
}

/**
 * Rough list prices in USD per million tokens, used ONLY to populate
 * provider_call_logs.estimated_cost for observability. These are estimates,
 * not billing data, and drift as OpenAI changes pricing. Longest prefix first.
 */
export const ESTIMATED_USD_PER_MILLION_TOKENS: ReadonlyArray<{ prefix: string; input: number; output: number }> = [
  { prefix: "gpt-5-nano", input: 0.05, output: 0.4 },
  { prefix: "gpt-5-mini", input: 0.25, output: 2 },
  { prefix: "gpt-5", input: 1.25, output: 10 },
  { prefix: "gpt-4.1-nano", input: 0.1, output: 0.4 },
  { prefix: "gpt-4.1-mini", input: 0.4, output: 1.6 },
  { prefix: "gpt-4.1", input: 2, output: 8 },
  { prefix: "gpt-4o-mini", input: 0.15, output: 0.6 },
  { prefix: "gpt-4o", input: 2.5, output: 10 },
  { prefix: "o4-mini", input: 1.1, output: 4.4 },
  { prefix: "o3", input: 2, output: 8 },
];
const DEFAULT_ESTIMATED_PRICE = { input: 1, output: 4 };

export function estimateCostUsd(model: string, inputTokens: number | null, outputTokens: number | null): number {
  const price = ESTIMATED_USD_PER_MILLION_TOKENS.find((p) => model.toLowerCase().startsWith(p.prefix)) ?? DEFAULT_ESTIMATED_PRICE;
  const cost = ((inputTokens ?? 0) * price.input + (outputTokens ?? 0) * price.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

// Error mapping -----------------------------------------------------------------

function readHeader(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== "object") return null;
  const maybeGet = (headers as { get?: unknown }).get;
  if (typeof maybeGet === "function") {
    const value: unknown = maybeGet.call(headers, name);
    return typeof value === "string" ? value : null;
  }
  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()];
  return typeof value === "string" ? value : null;
}

const DEFAULT_RETRY_AFTER_MS = 30_000;

function retryAfterMsFrom(headers: unknown): number {
  const ms = readHeader(headers, "retry-after-ms");
  if (ms && Number.isFinite(Number(ms))) return Math.max(0, Number(ms));
  const raw = readHeader(headers, "retry-after");
  if (raw) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(raw);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }
  return DEFAULT_RETRY_AFTER_MS;
}

/** Maps SDK / transport errors to typed AppErrors. Exported for tests. */
export function mapOpenAIError(err: unknown): AppError {
  if (isAppError(err)) return err;
  const e = (typeof err === "object" && err !== null ? err : {}) as {
    status?: unknown;
    name?: unknown;
    message?: unknown;
    headers?: unknown;
    code?: unknown;
  };
  const status = typeof e.status === "number" ? e.status : undefined;
  const name = typeof e.name === "string" ? e.name : "";
  const message = typeof e.message === "string" ? e.message : "OpenAI request failed";

  if (name === "APIConnectionTimeoutError" || name === "AbortError" || name === "TimeoutError") {
    return new AIUnavailableError("OpenAI request timed out", { retryable: true, details: { reason: "timeout" }, cause: err });
  }
  if (status === 429) {
    return new AIUnavailableError("OpenAI rate limit reached", {
      retryable: true,
      retryAfterMs: retryAfterMsFrom(e.headers),
      details: { status, reason: "rate_limited" },
      cause: err,
    });
  }
  if (status !== undefined && status >= 500) {
    return new AIUnavailableError("OpenAI is temporarily unavailable", { retryable: true, details: { status }, cause: err });
  }
  if (status === 401 || status === 403) {
    return new ProviderError("openai", status === 401 ? "authentication failed" : "access denied", {
      retryable: false,
      details: { status },
      cause: err,
    });
  }
  if (status !== undefined) {
    return new ProviderError("openai", `request rejected (${status})`, {
      retryable: false,
      details: { status, code: typeof e.code === "string" ? e.code : undefined, message: message.slice(0, 300) },
      cause: err,
    });
  }
  if (name === "APIConnectionError" || name === "FetchError") {
    return new AIUnavailableError("Could not reach OpenAI", { retryable: true, details: { reason: "connection" }, cause: err });
  }
  return new ProviderError("openai", message.slice(0, 300), { retryable: false, cause: err });
}

// Provider ------------------------------------------------------------------------

function extractRefusal(output: unknown): string | null {
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const p = part as { type?: unknown; refusal?: unknown };
      if (p?.type === "refusal" && typeof p.refusal === "string") return p.refusal;
    }
  }
  return null;
}

export function createOpenAIProvider(options: OpenAIProviderOptions): AIProvider {
  const model = options.model;
  const maxOutputTokens = options.maxOutputTokens ?? 700;
  const temperature = options.temperature ?? 0.7;
  const timeoutMs = options.timeoutMs ?? 45_000;
  const client: OpenAIResponsesClient =
    options.client ?? new OpenAI({ apiKey: options.apiKey, timeout: timeoutMs, maxRetries: options.maxRetries ?? 1 });

  const messageSchema = toStrictJsonSchema(generatedMessageSchema);
  const analysisSchema = toStrictJsonSchema(opportunityAnalysisSchema);

  async function run<T>(
    operation: string,
    prompt: BuiltPrompt,
    schema: JsonSchema,
    parse: (raw: unknown) => T,
    context: Record<string, Json>,
  ): Promise<AIResult<T>> {
    const request: OpenAIResponsesRequest = {
      model,
      instructions: prompt.instructions,
      input: prompt.input,
      max_output_tokens: maxOutputTokens,
      text: { format: { type: "json_schema", name: prompt.schemaName, schema, strict: true } },
    };
    if (!isReasoningModel(model)) request.temperature = temperature;

    // timedProviderCall spreads this object AFTER the call resolves, so the
    // token counts and cost written inside the call end up in the record.
    const callMeta: Omit<ProviderCallRecord, "durationMs" | "success" | "errorCode"> = {
      providerName: "openai",
      operation,
      estimatedCost: 0,
      requestContext: { model, promptVersion: PROMPT_VERSION, ...context },
    };

    const started = Date.now();
    return timedProviderCall(
      callMeta,
      async () => {
        let response: OpenAIResponsesResult;
        try {
          response = await client.responses.create(request, { timeout: timeoutMs });
        } catch (err) {
          throw mapOpenAIError(err);
        }
        const inputTokens = typeof response.usage?.input_tokens === "number" ? response.usage.input_tokens : null;
        const outputTokens = typeof response.usage?.output_tokens === "number" ? response.usage.output_tokens : null;
        callMeta.estimatedCost = estimateCostUsd(model, inputTokens, outputTokens);
        callMeta.requestContext = { ...callMeta.requestContext, inputTokens, outputTokens };

        if (response.status === "incomplete") {
          const reason = response.incomplete_details?.reason ?? "unknown";
          throw new AIInvalidOutputError("AI output was cut off before completion", { details: { reason, maxOutputTokens } });
        }
        if (response.status === "failed" || response.status === "cancelled") {
          throw new AIUnavailableError(`OpenAI response ${response.status}`, { retryable: true, details: { status: response.status } });
        }
        const text = response.output_text ?? "";
        if (!text.trim()) {
          const refusal = extractRefusal(response.output);
          throw new AIInvalidOutputError(refusal ? "AI declined to produce output" : "AI returned an empty output", {
            details: { reason: refusal ? "refusal" : "empty", refusal: refusal ?? undefined },
          });
        }
        const output = parse(text);
        const meta: AIGenerationMeta = {
          provider: "openai",
          model,
          latencyMs: Date.now() - started,
          inputTokens,
          outputTokens,
          promptVersion: PROMPT_VERSION,
        };
        return { output, meta };
      },
      (err) => (isAppError(err) ? err.code : "error"),
    );
  }

  return {
    name: "openai",
    model,
    isDemo: false,

    async generateMessage(input: GenerateMessageInput): Promise<AIResult<GeneratedMessage>> {
      const prompt = buildMessagePrompt(input, { maxOutputTokens });
      const result = await run(
        "generate_message",
        prompt,
        messageSchema,
        parseGeneratedMessage,
        { channel: input.channel, locale: input.locale, tone: input.tone, length: input.length, serviceKey: input.serviceKey },
      );
      // The request parameters are authoritative for these echo fields.
      return { ...result, output: { ...result.output, tone: input.tone, channel: input.channel } };
    },

    async analyzeOpportunity(input: AnalyzeOpportunityInput): Promise<AIResult<OpportunityAnalysis>> {
      const prompt = buildAnalysisPrompt(input, { maxOutputTokens });
      return run("analyze_opportunity", prompt, analysisSchema, parseOpportunityAnalysis, {
        locale: input.locale,
        serviceCount: input.services.length,
      });
    },
  };
}
