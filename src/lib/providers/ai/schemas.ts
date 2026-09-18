import { z } from "zod";

import { AIInvalidOutputError } from "@/lib/errors";
import type { GeneratedMessage, OpportunityAnalysis } from "@/types/ai";
import { TONES, type MessageChannel } from "@/types/common";

import { MAX_BODY_CHARS } from "./limits";

/**
 * Zod schemas for every AI output. The model is asked for JSON matching the
 * strict JSON Schema derived from these (see toStrictJsonSchema) and the
 * result is re-validated here, so nothing unvalidated reaches the app.
 */

// Exhaustive by construction: adding a channel to MessageChannel fails to compile here.
const CHANNEL_RECORD: Record<MessageChannel, true> = { whatsapp: true, email: true, instagram_dm: true };
export const CHANNEL_VALUES = Object.keys(CHANNEL_RECORD) as [MessageChannel, ...MessageChannel[]];

export const toneSchema = z.enum(TONES);
export const channelSchema = z.enum(CHANNEL_VALUES);

export const generatedMessageSchema = z.object({
  subject: z.string().max(120).nullable().describe("Subject line for e-mail; null for chat channels."),
  body: z.string().min(20).max(MAX_BODY_CHARS).describe("Plain-text message body including greeting and signature."),
  usedFacts: z
    .array(z.string().max(200))
    .max(25)
    .describe("JSON paths of the facts used, e.g. business.rating or business.topFindings[0]."),
  tone: toneSchema.describe("Echo of the requested tone."),
  channel: channelSchema.describe("Echo of the requested channel."),
});

export const opportunityAnalysisSchema = z.object({
  summary: z.string().min(1).max(700).describe("Two to three neutral sentences."),
  primaryRecommendation: z
    .object({
      serviceKey: z.string().min(1).max(80),
      rationale: z.string().min(1).max(500),
    })
    .nullable()
    .describe("The service with the strongest grounded case, or null when none stands out."),
  talkingPoints: z.array(z.string().min(1).max(300)).max(5).describe("Each grounded in a provided fact."),
  cautions: z.array(z.string().min(1).max(300)).max(5).describe("Unknown, not checked or unavailable items."),
});

export type GeneratedMessageOutput = z.infer<typeof generatedMessageSchema>;
export type OpportunityAnalysisOutput = z.infer<typeof opportunityAnalysisSchema>;

// Compile-time proof that the schemas produce the shared domain types.
const _messageCheck: GeneratedMessage = null as unknown as GeneratedMessageOutput;
const _analysisCheck: OpportunityAnalysis = null as unknown as OpportunityAnalysisOutput;
void _messageCheck;
void _analysisCheck;

export type JsonSchema = Record<string, unknown>;

/**
 * Converts a Zod schema into a JSON Schema accepted by OpenAI strict mode:
 * every property required, additionalProperties false everywhere, nullable
 * fields expressed as anyOf [..., {type: "null"}], no `oneOf`, no defaults and
 * no string length keywords (unsupported in strict mode; they are moved into
 * the description so the model still sees them, and Zod enforces them on parse).
 */
export function toStrictJsonSchema(schema: z.ZodType): JsonSchema {
  const raw = z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "any" }) as JsonSchema;
  const strict = strictify(raw);
  delete strict.$schema;
  return strict;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strictify(node: unknown): JsonSchema {
  if (!isRecord(node)) return {};
  const out: JsonSchema = { ...node };
  delete out.default;
  delete out.$id;
  delete out.id;

  // type: ["string", "null"] -> anyOf [{type: "string"}, {type: "null"}]
  if (Array.isArray(out.type)) {
    const types = out.type.filter((t): t is string => typeof t === "string");
    const nonNull = types.filter((t) => t !== "null");
    if (types.length !== nonNull.length && nonNull.length >= 1) {
      const rest: JsonSchema = { ...out };
      delete rest.type;
      const variants = nonNull.map((t) => strictify({ ...rest, type: t }));
      return { anyOf: [...variants, { type: "null" }], ...(typeof out.description === "string" ? { description: out.description } : {}) };
    }
    out.type = nonNull[0];
  }

  const union = Array.isArray(out.anyOf) ? out.anyOf : Array.isArray(out.oneOf) ? out.oneOf : null;
  if (union) {
    delete out.oneOf;
    out.anyOf = union.map((variant) => strictify(variant));
  }

  if (out.type === "object" || isRecord(out.properties)) {
    const properties = isRecord(out.properties) ? out.properties : {};
    const strictProps: JsonSchema = {};
    for (const [key, value] of Object.entries(properties)) strictProps[key] = strictify(value);
    out.type = "object";
    out.properties = strictProps;
    out.required = Object.keys(strictProps);
    out.additionalProperties = false;
  }

  if (out.type === "array") {
    if (Array.isArray(out.items)) out.items = out.items.map((item) => strictify(item));
    else if (out.items !== undefined) out.items = strictify(out.items);
    delete out.prefixItems;
  }

  if (out.type === "string") {
    const hints: string[] = [];
    if (typeof out.minLength === "number") hints.push(`at least ${out.minLength} characters`);
    if (typeof out.maxLength === "number") hints.push(`at most ${out.maxLength} characters`);
    delete out.minLength;
    delete out.maxLength;
    if (hints.length) {
      const existing = typeof out.description === "string" ? `${out.description.trim()} ` : "";
      out.description = `${existing}Length: ${hints.join(", ")}.`;
    }
  }

  return out;
}

function parseJsonText(raw: string, what: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new AIInvalidOutputError(`AI ${what} was not valid JSON`, {
      details: { reason: "invalid_json", snippet: raw.slice(0, 200) },
      cause: err,
    });
  }
}

function parseWith<T>(schema: z.ZodType<T>, raw: unknown, what: string): T {
  const value = typeof raw === "string" ? parseJsonText(raw, what) : raw;
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AIInvalidOutputError(`AI ${what} failed validation`, {
      details: {
        reason: "schema_mismatch",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          code: issue.code,
          message: issue.message,
        })),
      },
    });
  }
  return result.data;
}

/** Accepts a parsed object or a JSON string. Throws AIInvalidOutputError with issue details. */
export function parseGeneratedMessage(raw: unknown): GeneratedMessage {
  return parseWith(generatedMessageSchema, raw, "message output");
}

/** Accepts a parsed object or a JSON string. Throws AIInvalidOutputError with issue details. */
export function parseOpportunityAnalysis(raw: unknown): OpportunityAnalysis {
  return parseWith(opportunityAnalysisSchema, raw, "analysis output");
}
