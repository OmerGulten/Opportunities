"use server";

import { revalidatePath } from "next/cache";

import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { AppError, type ErrorCode } from "@/lib/errors";
import { getT } from "@/lib/i18n";
import { createLogger } from "@/lib/logging";
import type { PipelineStageRow } from "@/types/db";

import { addNoteSchema, scheduleFollowUpSchema, updateLeadSchema } from "./schemas";
import { addNote, removeLead, scheduleFollowUp, updateLead } from "./service";

/**
 * Server actions for the lead detail page.
 *
 * The board moves cards through `PATCH /api/leads/:id` because it needs an
 * optimistic, revertible round trip. The detail page uses these actions so a
 * successful mutation can revalidate the affected routes in the same request.
 *
 * Nothing here contacts a business: follow-ups are reminders, never sends.
 */

export type PipelineActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } };

const log = createLogger({ scope: "pipeline.actions" });

async function translate() {
  const locale = await getRequestLocale();
  return getT(locale, "pipeline");
}

function fail(code: ErrorCode, message: string): PipelineActionResult<never> {
  return { ok: false, error: { code, message } };
}

async function failUnexpected(scope: string, cause: unknown, messageKey: string): Promise<PipelineActionResult<never>> {
  const t = await translate();
  if (cause instanceof AppError) {
    log.warn("action_app_error", { scope, code: cause.code });
    return fail(cause.code, t(messageKey));
  }
  log.error("action_failed", { scope, error: cause instanceof Error ? cause.message : String(cause) });
  return fail("internal_error", t(messageKey));
}

function revalidateLead(leadId: string): void {
  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${leadId}`);
  revalidatePath("/dashboard");
}

/**
 * Updates stage, owner, amounts, loss reason and contact dates.
 *
 * A move into a stage flagged `is_lost` is rejected without a reason so the
 * "why" is captured while it is still known, rather than reconstructed later.
 */
export async function saveLead(leadId: string, input: unknown): Promise<PipelineActionResult<{ id: string }>> {
  const parsed = updateLeadSchema.safeParse(input);
  if (!parsed.success) {
    const t = await translate();
    return fail("validation_error", t("detail.saveError"));
  }

  try {
    const ctx = await requireWorkspaceContext();

    if (parsed.data.stageId) {
      const { data: stage } = await ctx.supabase
        .from("pipeline_stages")
        .select("id, is_lost")
        .eq("id", parsed.data.stageId)
        .eq("workspace_id", ctx.workspace.id)
        .maybeSingle<Pick<PipelineStageRow, "id" | "is_lost">>();

      if (stage?.is_lost) {
        const reason = parsed.data.lossReason?.trim();
        if (!reason) {
          const { data: existing } = await ctx.supabase
            .from("leads")
            .select("loss_reason")
            .eq("id", leadId)
            .eq("workspace_id", ctx.workspace.id)
            .maybeSingle<{ loss_reason: string | null }>();
          if (!existing?.loss_reason?.trim()) {
            const t = await translate();
            return fail("validation_error", t("move.lossRequired"));
          }
        }
      }
    }

    const lead = await updateLead(ctx, leadId, parsed.data);
    revalidateLead(lead.id);
    return { ok: true, data: { id: lead.id } };
  } catch (cause) {
    return failUnexpected("saveLead", cause, "detail.saveError");
  }
}

/** Appends a note to the lead's own record. */
export async function createLeadNote(input: unknown): Promise<PipelineActionResult<{ id: string }>> {
  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) {
    const t = await translate();
    return fail("validation_error", t("notes.required"));
  }

  try {
    const ctx = await requireWorkspaceContext();
    const note = await addNote(ctx, parsed.data);
    revalidateLead(parsed.data.leadId);
    return { ok: true, data: { id: note.id } };
  } catch (cause) {
    return failUnexpected("createLeadNote", cause, "notes.error");
  }
}

/** Sets or clears the reminder date. Nothing is sent when it comes due. */
export async function setLeadFollowUp(input: unknown): Promise<PipelineActionResult<{ nextFollowUpAt: string | null }>> {
  const parsed = scheduleFollowUpSchema.safeParse(input);
  if (!parsed.success) {
    const t = await translate();
    return fail("validation_error", t("followUp.required"));
  }

  try {
    const ctx = await requireWorkspaceContext();
    const lead = await scheduleFollowUp(ctx, parsed.data);
    revalidateLead(parsed.data.leadId);
    return { ok: true, data: { nextFollowUpAt: lead.next_follow_up_at } };
  } catch (cause) {
    return failUnexpected("setLeadFollowUp", cause, "followUp.error");
  }
}

/** Deletes the pipeline record. The business and its audits are untouched. */
export async function deleteLead(leadId: string): Promise<PipelineActionResult<{ id: string }>> {
  try {
    const ctx = await requireWorkspaceContext();
    await removeLead(ctx, leadId);
    revalidateLead(leadId);
    return { ok: true, data: { id: leadId } };
  } catch (cause) {
    return failUnexpected("deleteLead", cause, "detail.removeError");
  }
}
