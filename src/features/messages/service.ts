import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { recordActivity } from "@/lib/activity";
import type { WorkspaceContext } from "@/lib/auth/context";
import { appUrl } from "@/lib/config/env";
import { creditKeys, REFERENCE_TYPES } from "@/lib/credits/keys";
import { buildPricingTable } from "@/lib/credits/pricing";
import { getCreditService } from "@/lib/credits/server";
import { listCreditPricingRules } from "@/lib/db/reference";
import { getAISettings } from "@/lib/db/settings";
import { NotFoundError, ValidationError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { generateWithGuard } from "@/lib/providers/ai";
import { getAIProvider } from "@/lib/providers/registry";
import type { GenerateMessageInput, GeneratedMessage } from "@/types/ai";
import type { MessageRow, MessageTemplateRow, PublicReportRow, ServiceRow } from "@/types/db";

import { loadBusinessFacts, loadOfferingFacts } from "./facts";
import { buildVariableContext, resolveTemplate } from "./variables";
import type { GenerateMessageRequest, SaveMessageRequest, UpdateMessageStatusRequest } from "./schemas";

export interface GenerateMessageResult {
  message: GeneratedMessage;
  generationId: string;
  provider: string;
  model: string;
  isDemo: boolean;
  creditsConsumed: number;
  /** Fact-guard findings. Non-empty means the draft mentioned something unverified. */
  warnings: Array<{ type: string; detail: string }>;
  attempts: number;
}

/**
 * Drafts an outreach message for a business.
 *
 * The model only ever receives verified facts (see ./facts.ts); the generated
 * text is then checked back against those same facts, and anything it could not
 * have known is surfaced as a warning rather than silently shipped. Nothing is
 * sent anywhere: the user reviews, edits and opens the channel themselves.
 */
export async function generateMessage(ctx: WorkspaceContext, request: GenerateMessageRequest): Promise<GenerateMessageResult> {
  const bundle = await loadBusinessFacts({
    supabase: ctx.supabase,
    workspace: ctx.workspace,
    businessId: request.businessId,
    locale: request.locale ?? ctx.locale,
  });
  if (!bundle) throw new NotFoundError("Business not found");

  const locale = request.locale ?? ctx.locale;
  const service = await loadService(ctx, request.serviceId);
  const offering = await loadOfferingFacts(ctx.supabase, ctx.workspace.id, request.serviceId ?? null);
  const template = request.templateId ? await loadTemplate(ctx, request.templateId) : null;
  const reportLink = request.includeReportLink ? await activeReportLink(ctx, request.businessId) : null;

  // A template is a starting structure, not a source of facts: it is resolved
  // with verified values first, and unknown variables are removed rather than
  // rendered as "undefined".
  let templateBody: string | null = null;
  let templateSubject: string | null = null;
  if (template) {
    const context = buildVariableContext({
      facts: bundle.facts,
      sender: bundle.sender,
      offering,
      primaryService: service?.key ?? null,
      opportunityScore: bundle.opportunity?.overall_score ?? null,
      reportLink,
      mapsUrl: bundle.mapsUrl,
      locale,
    });
    templateBody = resolveTemplate(template.body, context).text;
    templateSubject = template.subject ? resolveTemplate(template.subject, context).text : null;
  }

  const input: GenerateMessageInput = {
    locale,
    channel: request.channel,
    tone: request.tone ?? (ctx.workspace.default_tone as GenerateMessageInput["tone"]) ?? "friendly_professional",
    length: request.length ?? "medium",
    serviceKey: service?.key ?? "general",
    serviceLabel: service ? (locale === "en" ? service.name_en : service.name_tr) : "",
    business: bundle.facts,
    sender: bundle.sender,
    offering,
    templateBody,
    templateSubject,
    reportLink,
    userInstruction: request.instruction ?? null,
  };

  const provider = getAIProvider();
  const settings = await getAISettings();
  const generationId = randomUUID();
  const started = Date.now();

  // Billing is settled around the provider call, not after it.
  //
  // This used to charge once the draft existed and swallow any failure that was
  // not InsufficientCreditsError, so a database or ledger outage produced a
  // free generation that we had already paid OpenAI for. Holding the credits
  // first means an unavailable ledger stops the work instead of giving it away,
  // and the hold is released if the provider fails. If the final consume fails
  // the request fails too: a stranded reservation is visible and reconcilable,
  // an unbilled generation is not.
  const pricing = buildPricingTable(await listCreditPricingRules(ctx.supabase));
  const price = pricing.ai_message;
  const credits = getCreditService();
  const billingReference = { workspaceId: ctx.workspace.id, referenceType: REFERENCE_TYPES.message, referenceId: generationId };

  if (price > 0) {
    await credits.reserve({
      ...billingReference,
      amount: price,
      idempotencyKey: creditKeys.aiMessageReserve(generationId),
      metadata: { businessId: request.businessId, channel: request.channel },
      actorId: ctx.user.id,
    });
  }

  let generated: Awaited<ReturnType<typeof generateWithGuard>>;
  try {
    generated = await generateWithGuard(provider, input, { maxAttempts: 2 });
  } catch (err) {
    if (price > 0) {
      // Best effort by necessity: the generation failure is the error the caller
      // needs to see, and a held reservation is recoverable. It is logged so a
      // stuck hold can be found, and the fixed key keeps a retry idempotent.
      await credits
        .releaseReservation({ ...billingReference, idempotencyKey: creditKeys.aiMessageRelease(generationId), actorId: ctx.user.id })
        .catch((releaseError: unknown) => {
          logger.error("ai_message_reservation_release_failed", {
            generationId,
            error: releaseError instanceof Error ? releaseError.message : String(releaseError),
          });
        });
    }
    await recordGeneration(ctx, {
      generationId,
      businessId: request.businessId,
      provider: provider.name,
      model: provider.model,
      status: "failed",
      latencyMs: Date.now() - started,
      errorCode: toAppError(err).code,
      promptVersion: settings.prompt_version,
      factsHash: hashFacts(input),
      creditsConsumed: 0,
    });
    throw err;
  }

  // The draft exists; convert the hold into a charge. A failure here throws:
  // returning the draft anyway is precisely the free-operation path this
  // replaced. The reservation survives for reconciliation.
  let creditsConsumed = 0;
  if (price > 0) {
    await credits.consume({
      ...billingReference,
      amount: price,
      idempotencyKey: creditKeys.aiMessage(generationId),
      metadata: { businessId: request.businessId, channel: request.channel },
      actorId: ctx.user.id,
    });
    creditsConsumed = price;
  }

  await recordGeneration(ctx, {
    generationId,
    businessId: request.businessId,
    provider: generated.result.meta.provider,
    model: generated.result.meta.model,
    status: "success",
    latencyMs: generated.result.meta.latencyMs,
    inputTokens: generated.result.meta.inputTokens,
    outputTokens: generated.result.meta.outputTokens,
    promptVersion: generated.result.meta.promptVersion,
    factsHash: hashFacts(input),
    creditsConsumed,
  });

  await recordActivity(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    businessId: request.businessId,
    actorId: ctx.user.id,
    type: "message_generated",
    metadata: { channel: request.channel, serviceId: request.serviceId ?? null, provider: provider.name, warnings: generated.guard.violations.length },
  });

  return {
    message: generated.result.output,
    generationId,
    provider: generated.result.meta.provider,
    model: generated.result.meta.model,
    isDemo: provider.isDemo,
    creditsConsumed,
    warnings: generated.guard.violations.map((violation) => ({ type: violation.type, detail: violation.detail })),
    attempts: generated.attempts,
  };
}

/** Persists a draft the user has reviewed (and possibly edited). */
export async function saveMessage(ctx: WorkspaceContext, request: SaveMessageRequest): Promise<MessageRow> {
  const { data: lead } = await ctx.supabase
    .from("leads")
    .select("id")
    .eq("workspace_id", ctx.workspace.id)
    .eq("business_id", request.businessId)
    .maybeSingle<{ id: string }>();

  const { data, error } = await ctx.supabase
    .from("messages")
    .insert({
      workspace_id: ctx.workspace.id,
      business_id: request.businessId,
      lead_id: lead?.id ?? null,
      template_id: request.templateId ?? null,
      service_id: request.serviceId ?? null,
      generation_id: request.generationId ?? null,
      channel: request.channel,
      tone: request.tone ?? null,
      subject: request.subject ?? null,
      body: request.body,
      status: request.edited ? "edited" : "draft",
      created_by: ctx.user.id,
    })
    .select("*")
    .single<MessageRow>();
  if (error || !data) throw toAppError(error ?? new Error("Message could not be saved"));

  if (request.generationId) {
    await ctx.supabase.from("message_generations").update({ message_id: data.id }).eq("id", request.generationId);
  }
  if (request.templateId) {
    // Usage counting is telemetry, not part of the save contract.
    const { error: usageError } = await ctx.supabase.rpc("increment_template_usage", { p_template: request.templateId });
    if (usageError) logger.warn("template_usage_increment_failed", { templateId: request.templateId, error: usageError.message });
  }

  await recordActivity(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    businessId: request.businessId,
    leadId: lead?.id ?? null,
    actorId: ctx.user.id,
    type: request.edited ? "message_edited" : "message_generated",
    metadata: { channel: request.channel, messageId: data.id },
  });

  return data;
}

/**
 * Records that the user copied the text or opened the channel. We never send
 * anything ourselves, so this is the closest thing to a "sent" signal.
 */
export async function updateMessageStatus(ctx: WorkspaceContext, request: UpdateMessageStatusRequest): Promise<MessageRow> {
  const now = new Date().toISOString();
  const patch: Partial<MessageRow> = { status: request.status };
  if (request.status === "copied") patch.copied_at = now;
  if (request.status === "channel_opened") patch.channel_opened_at = now;

  const { data, error } = await ctx.supabase
    .from("messages")
    .update(patch)
    .eq("id", request.messageId)
    .eq("workspace_id", ctx.workspace.id)
    .select("*")
    .single<MessageRow>();
  if (error || !data) throw toAppError(error ?? new NotFoundError("Message not found"));

  if (request.status === "copied" || request.status === "channel_opened" || request.status === "sent_manually") {
    await ctx.supabase
      .from("leads")
      .update({ last_contacted_at: now })
      .eq("workspace_id", ctx.workspace.id)
      .eq("business_id", data.business_id);
  }

  await recordActivity(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    businessId: data.business_id,
    leadId: data.lead_id,
    actorId: ctx.user.id,
    type: request.status === "channel_opened" ? "channel_opened" : "message_copied",
    metadata: { channel: data.channel, messageId: data.id },
  });

  return data;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function loadService(ctx: WorkspaceContext, serviceId?: string | null): Promise<ServiceRow | null> {
  if (!serviceId) return null;
  const { data } = await ctx.supabase.from("services").select("*").eq("id", serviceId).maybeSingle<ServiceRow>();
  return data ?? null;
}

async function loadTemplate(ctx: WorkspaceContext, templateId: string): Promise<MessageTemplateRow> {
  const { data } = await ctx.supabase.from("message_templates").select("*").eq("id", templateId).maybeSingle<MessageTemplateRow>();
  if (!data) throw new ValidationError("Template not found");
  return data;
}

/** Returns the public link for a live report, if the user asked to include one. */
async function activeReportLink(ctx: WorkspaceContext, businessId: string): Promise<string | null> {
  const { data } = await ctx.supabase
    .from("public_reports")
    .select("token, expires_at, revoked_at")
    .eq("workspace_id", ctx.workspace.id)
    .eq("business_id", businessId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<PublicReportRow, "token" | "expires_at" | "revoked_at">>();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;
  return appUrl(`/report/${data.token}`);
}

/** Stable fingerprint of the facts a draft was based on, for auditability. */
function hashFacts(input: GenerateMessageInput): string {
  return createHash("sha256")
    .update(JSON.stringify({ business: input.business, service: input.serviceKey, channel: input.channel, offering: input.offering }))
    .digest("hex")
    .slice(0, 32);
}

async function recordGeneration(
  ctx: WorkspaceContext,
  input: {
    generationId: string;
    businessId: string;
    provider: string;
    model: string;
    status: "success" | "failed" | "invalid_output" | "unavailable";
    latencyMs: number;
    inputTokens?: number | null;
    outputTokens?: number | null;
    promptVersion: string;
    factsHash: string;
    creditsConsumed: number;
    errorCode?: string | null;
  },
): Promise<void> {
  const { error } = await ctx.supabase.from("message_generations").insert({
    id: input.generationId,
    workspace_id: ctx.workspace.id,
    business_id: input.businessId,
    provider: input.provider,
    model: input.model,
    status: input.status,
    latency_ms: input.latencyMs,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    prompt_version: input.promptVersion,
    facts_hash: input.factsHash,
    // Only the fingerprint and counts are stored; message bodies stay out of logs.
    facts_used: {},
    error_code: input.errorCode ?? null,
    credits_consumed: input.creditsConsumed,
    created_by: ctx.user.id,
  });
  if (error) logger.warn("message_generation_log_failed", { generationId: input.generationId, error: error.message });
}
