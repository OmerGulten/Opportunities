import type { AIProvider, AIResult, GenerateMessageInput, GeneratedMessage } from "@/types/ai";

import { verifyMessageAgainstFacts, type FactGuardReport } from "./fact-guard";
import { appendCorrectiveInstruction } from "./prompts";

export {
  CHANNEL_LIMITS,
  EMAIL_WORD_RANGES,
  CHAT_LENGTH_RATIO,
  EMAIL_WORD_TOLERANCE,
  MAX_BODY_CHARS,
  targetBodyChars,
  countWords,
  type ChannelLimit,
} from "./limits";
export {
  generatedMessageSchema,
  opportunityAnalysisSchema,
  toneSchema,
  channelSchema,
  CHANNEL_VALUES,
  toStrictJsonSchema,
  parseGeneratedMessage,
  parseOpportunityAnalysis,
  type GeneratedMessageOutput,
  type OpportunityAnalysisOutput,
  type JsonSchema,
} from "./schemas";
export {
  PROMPT_VERSION,
  MESSAGE_SCHEMA_NAME,
  ANALYSIS_SCHEMA_NAME,
  FACT_RULES,
  buildMessagePrompt,
  buildAnalysisPrompt,
  appendCorrectiveInstruction,
  type BuiltPrompt,
} from "./prompts";
export { verifyMessageAgainstFacts, type FactGuardReport, type FactGuardViolation, type FactGuardViolationType } from "./fact-guard";
export {
  createOpenAIProvider,
  isReasoningModel,
  estimateCostUsd,
  mapOpenAIError,
  ESTIMATED_USD_PER_MILLION_TOKENS,
  type OpenAIProviderOptions,
  type OpenAIResponsesClient,
  type OpenAIResponsesRequest,
  type OpenAIResponsesResult,
} from "./openai";
export { createDemoAIProvider, type DemoAIProviderOptions } from "./demo";

export interface GuardedGeneration {
  result: AIResult<GeneratedMessage>;
  guard: FactGuardReport;
  attempts: number;
}

/**
 * Generates a message and verifies it against the facts. When the guard finds
 * violations and attempts remain, the model is asked once more with a
 * corrective note appended to the user instruction. The last result is returned
 * together with its guard report; the caller decides whether to show a warning
 * or block. The guard always runs against the ORIGINAL input so the quoted
 * fragments in the corrective note cannot whitelist themselves.
 */
export async function generateWithGuard(
  provider: AIProvider,
  input: GenerateMessageInput,
  options: { maxAttempts?: number } = {},
): Promise<GuardedGeneration> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 2));
  let current: GenerateMessageInput = input;
  let attempts = 0;
  let last: GuardedGeneration | null = null;

  while (attempts < maxAttempts) {
    attempts += 1;
    const result = await provider.generateMessage(current);
    const guard = verifyMessageAgainstFacts(result.output, input);
    last = { result, guard, attempts };
    if (guard.ok || attempts >= maxAttempts) break;
    current = { ...input, userInstruction: appendCorrectiveInstruction(input.userInstruction, guard.violations) };
  }

  // maxAttempts >= 1 guarantees at least one iteration.
  return last as GuardedGeneration;
}
