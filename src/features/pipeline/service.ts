import "server-only";

import { recordActivity } from "@/lib/activity";
import type { WorkspaceContext } from "@/lib/auth/context";
import { ConflictError, NotFoundError, ValidationError, toAppError } from "@/lib/errors";
import type { LeadNoteRow, LeadRow, PipelineStageRow } from "@/types/db";

import type { AddNoteRequest, CreateLeadRequest, ScheduleFollowUpRequest, UpdateLeadRequest } from "./schemas";

/**
 * Pipeline operations.
 *
 * A lead is the CRM record for a business the user decided to pursue; it is kept
 * separate from the business identity and from provider data so replacing a
 * provider never touches the user's own sales work.
 */

export async function addLead(ctx: WorkspaceContext, request: CreateLeadRequest): Promise<LeadRow> {
  const business = await assertBusinessInWorkspace(ctx, request.businessId);
  const stage = request.stageId ? await requireStage(ctx, request.stageId) : await defaultStage(ctx);

  const existing = await findLead(ctx, request.businessId);
  if (existing) throw new ConflictError("This business is already in the pipeline", { details: { leadId: existing.id } });

  const { data, error } = await ctx.supabase
    .from("leads")
    .insert({
      workspace_id: ctx.workspace.id,
      business_id: request.businessId,
      stage_id: stage.id,
      status: "open",
      owner_id: request.ownerId ?? ctx.user.id,
      source_scan_id: request.sourceScanId ?? business.first_scan_id ?? null,
      primary_service_id: request.primaryServiceId ?? business.primary_service_id ?? null,
      estimated_value: request.estimatedValue ?? null,
      created_by: ctx.user.id,
    })
    .select("*")
    .single<LeadRow>();
  if (error || !data) throw toAppError(error ?? new Error("Lead could not be created"));

  if (request.note) {
    await ctx.supabase.from("lead_notes").insert({ lead_id: data.id, workspace_id: ctx.workspace.id, author_id: ctx.user.id, body: request.note });
  }

  await recordActivity(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    leadId: data.id,
    businessId: request.businessId,
    actorId: ctx.user.id,
    type: "lead_added",
    metadata: { stage: stage.key },
  });

  return data;
}

export async function updateLead(ctx: WorkspaceContext, leadId: string, request: UpdateLeadRequest): Promise<LeadRow> {
  const lead = await requireLead(ctx, leadId);

  const patch: Record<string, unknown> = {};
  let movedTo: PipelineStageRow | null = null;

  if (request.stageId && request.stageId !== lead.stage_id) {
    movedTo = await requireStage(ctx, request.stageId);
    patch.stage_id = movedTo.id;
    // Won/lost stages carry the lead status with them so both stay consistent.
    if (movedTo.is_won) patch.status = "won";
    else if (movedTo.is_lost) patch.status = "lost";
    else if (lead.status === "won" || lead.status === "lost") patch.status = "open";
  }

  if (request.status !== undefined) patch.status = request.status;
  if (request.ownerId !== undefined) patch.owner_id = request.ownerId;
  if (request.primaryServiceId !== undefined) patch.primary_service_id = request.primaryServiceId;
  if (request.estimatedValue !== undefined) patch.estimated_value = request.estimatedValue;
  if (request.wonValue !== undefined) patch.won_value = request.wonValue;
  if (request.currency !== undefined) patch.currency = request.currency;
  if (request.lossReason !== undefined) patch.loss_reason = request.lossReason;
  if (request.nextFollowUpAt !== undefined) patch.next_follow_up_at = request.nextFollowUpAt;
  if (request.lastContactedAt !== undefined) patch.last_contacted_at = request.lastContactedAt;

  if (patch.status === "lost" && !patch.loss_reason && !lead.loss_reason) {
    // Not fatal, but a lost lead without a reason is data we will wish we had.
    patch.loss_reason = null;
  }

  const { data, error } = await ctx.supabase
    .from("leads")
    .update(patch)
    .eq("id", leadId)
    .eq("workspace_id", ctx.workspace.id)
    .select("*")
    .single<LeadRow>();
  if (error || !data) throw toAppError(error ?? new Error("Lead could not be updated"));

  if (movedTo) {
    const fromStage = await stageById(ctx, lead.stage_id);
    await recordActivity(ctx.supabase, {
      workspaceId: ctx.workspace.id,
      leadId,
      businessId: lead.business_id,
      actorId: ctx.user.id,
      type: movedTo.is_won ? "lead_won" : movedTo.is_lost ? "lead_lost" : "stage_changed",
      metadata: { from: fromStage?.key ?? null, to: movedTo.key, wonValue: data.won_value },
    });
  }

  return data;
}

export async function addNote(ctx: WorkspaceContext, request: AddNoteRequest): Promise<LeadNoteRow> {
  const lead = await requireLead(ctx, request.leadId);
  const { data, error } = await ctx.supabase
    .from("lead_notes")
    .insert({ lead_id: lead.id, workspace_id: ctx.workspace.id, author_id: ctx.user.id, body: request.body })
    .select("*")
    .single<LeadNoteRow>();
  if (error || !data) throw toAppError(error ?? new Error("Note could not be added"));

  await recordActivity(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    leadId: lead.id,
    businessId: lead.business_id,
    actorId: ctx.user.id,
    type: "note_added",
  });
  return data;
}

/** MVP follow-ups are reminders only; nothing is auto-sent. */
export async function scheduleFollowUp(ctx: WorkspaceContext, request: ScheduleFollowUpRequest): Promise<LeadRow> {
  const lead = await requireLead(ctx, request.leadId);
  const { data, error } = await ctx.supabase
    .from("leads")
    .update({ next_follow_up_at: request.nextFollowUpAt })
    .eq("id", lead.id)
    .eq("workspace_id", ctx.workspace.id)
    .select("*")
    .single<LeadRow>();
  if (error || !data) throw toAppError(error ?? new Error("Follow-up could not be scheduled"));

  if (request.note) {
    await ctx.supabase.from("lead_notes").insert({ lead_id: lead.id, workspace_id: ctx.workspace.id, author_id: ctx.user.id, body: request.note });
  }

  await recordActivity(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    leadId: lead.id,
    businessId: lead.business_id,
    actorId: ctx.user.id,
    type: request.nextFollowUpAt ? "follow_up_scheduled" : "follow_up_completed",
    metadata: { nextFollowUpAt: request.nextFollowUpAt },
  });
  return data;
}

export async function removeLead(ctx: WorkspaceContext, leadId: string): Promise<void> {
  const lead = await requireLead(ctx, leadId);
  const { error } = await ctx.supabase.from("leads").delete().eq("id", leadId).eq("workspace_id", ctx.workspace.id);
  if (error) throw toAppError(error);
  await recordActivity(ctx.supabase, {
    workspaceId: ctx.workspace.id,
    businessId: lead.business_id,
    actorId: ctx.user.id,
    type: "lead_lost",
    metadata: { removed: true },
  });
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function requireLead(ctx: WorkspaceContext, leadId: string): Promise<LeadRow> {
  const { data, error } = await ctx.supabase.from("leads").select("*").eq("id", leadId).eq("workspace_id", ctx.workspace.id).maybeSingle<LeadRow>();
  if (error) throw toAppError(error);
  if (!data) throw new NotFoundError("Lead not found");
  return data;
}

async function findLead(ctx: WorkspaceContext, businessId: string): Promise<LeadRow | null> {
  const { data } = await ctx.supabase.from("leads").select("*").eq("workspace_id", ctx.workspace.id).eq("business_id", businessId).maybeSingle<LeadRow>();
  return data ?? null;
}

async function requireStage(ctx: WorkspaceContext, stageId: string): Promise<PipelineStageRow> {
  const stage = await stageById(ctx, stageId);
  if (!stage) throw new ValidationError("Pipeline stage not found");
  return stage;
}

async function stageById(ctx: WorkspaceContext, stageId: string): Promise<PipelineStageRow | null> {
  const { data } = await ctx.supabase
    .from("pipeline_stages")
    .select("*")
    .eq("id", stageId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<PipelineStageRow>();
  return data ?? null;
}

async function defaultStage(ctx: WorkspaceContext): Promise<PipelineStageRow> {
  const { data } = await ctx.supabase
    .from("pipeline_stages")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("is_default", { ascending: false })
    .order("sort_order")
    .limit(1)
    .maybeSingle<PipelineStageRow>();
  if (!data) throw new ValidationError("This workspace has no pipeline stages");
  return data;
}

async function assertBusinessInWorkspace(ctx: WorkspaceContext, businessId: string): Promise<{ first_scan_id: string | null; primary_service_id: string | null }> {
  const { data } = await ctx.supabase
    .from("businesses")
    .select("id, first_scan_id, opportunities(primary_service_id)")
    .eq("id", businessId)
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle<{ id: string; first_scan_id: string | null; opportunities: { primary_service_id: string | null } | null }>();
  if (!data) throw new NotFoundError("Business not found");
  return { first_scan_id: data.first_scan_id, primary_service_id: data.opportunities?.primary_service_id ?? null };
}
