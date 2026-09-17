import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logging";
import type { Json } from "@/types/common";

/**
 * Activity timeline abstraction. Every important event appends a row to
 * lead_activities. Works with the user client (RLS) or the admin client
 * (workflow steps). Future integrations append through the same function.
 */
export type ActivityType =
  | "scan_started"
  | "scan_completed"
  | "scan_failed"
  | "scan_cancelled"
  | "business_discovered"
  | "audit_completed"
  | "audit_refreshed"
  | "opportunity_calculated"
  | "message_generated"
  | "message_edited"
  | "message_copied"
  | "channel_opened"
  | "lead_added"
  | "stage_changed"
  | "note_added"
  | "follow_up_scheduled"
  | "follow_up_completed"
  | "lead_won"
  | "lead_lost"
  | "lead_reopened"
  | "report_created"
  | "report_revoked"
  | "business_ignored"
  | "business_unignored";

export interface ActivityInput {
  workspaceId: string;
  type: ActivityType;
  title?: string;
  leadId?: string | null;
  businessId?: string | null;
  scanId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, Json>;
}

export async function recordActivity(supabase: SupabaseClient, input: ActivityInput): Promise<void> {
  const { error } = await supabase.from("lead_activities").insert({
    workspace_id: input.workspaceId,
    type: input.type,
    title: input.title ?? null,
    lead_id: input.leadId ?? null,
    business_id: input.businessId ?? null,
    scan_id: input.scanId ?? null,
    actor_id: input.actorId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) {
    // Activities are best-effort; never fail the main operation.
    logger.warn("activity_insert_failed", { type: input.type, workspaceId: input.workspaceId, error: error.message });
  }
}

export async function recordActivities(supabase: SupabaseClient, inputs: ActivityInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const { error } = await supabase.from("lead_activities").insert(
    inputs.map((input) => ({
      workspace_id: input.workspaceId,
      type: input.type,
      title: input.title ?? null,
      lead_id: input.leadId ?? null,
      business_id: input.businessId ?? null,
      scan_id: input.scanId ?? null,
      actor_id: input.actorId ?? null,
      metadata: input.metadata ?? {},
    })),
  );
  if (error) logger.warn("activity_bulk_insert_failed", { count: inputs.length, error: error.message });
}
