import "server-only";

import type { PipelineOwnerModel, PipelineStageModel } from "@/features/pipeline/components/types";
import { listTeam } from "@/features/settings/service";
import type { WorkspaceContext } from "@/lib/auth/context";
import { pickLocalized } from "@/lib/i18n";
import type { PipelineStageRow, ServiceRow } from "@/types/db";

/**
 * Reference reads the two pipeline routes share.
 *
 * These are reads of small workspace/reference tables mapped straight into the
 * view models the client components expect; the pipeline's own domain logic
 * stays in `features/pipeline/{service,queries}.ts`.
 */

export async function loadStages(ctx: WorkspaceContext): Promise<PipelineStageModel[]> {
  const { data } = await ctx.supabase
    .from("pipeline_stages")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("sort_order")
    .returns<PipelineStageRow[]>();

  return (data ?? []).map((stage) => ({
    id: stage.id,
    key: stage.key,
    name: stage.name,
    color: stage.color,
    sortOrder: stage.sort_order,
    isWon: stage.is_won,
    isLost: stage.is_lost,
  }));
}

/** Workspace members, used for the owner filter and the owner select. */
export async function loadOwners(ctx: WorkspaceContext): Promise<PipelineOwnerModel[]> {
  const team = await listTeam(ctx);
  return team.map((member) => ({
    id: member.userId,
    name: member.displayName ?? member.email ?? member.userId,
  }));
}

export interface ServiceLabel {
  name: string;
  icon: string | null;
}

/** Service key -> localized label, so lead cards can name the primary service. */
export async function loadServiceLabels(ctx: WorkspaceContext): Promise<Map<string, ServiceLabel>> {
  const { data } = await ctx.supabase.from("services").select("id, key, name_tr, name_en, icon").returns<
    Array<Pick<ServiceRow, "id" | "key" | "name_tr" | "name_en" | "icon">>
  >();

  const labels = new Map<string, ServiceLabel>();
  for (const service of data ?? []) {
    labels.set(service.key, { name: pickLocalized(service, "name", ctx.locale), icon: service.icon });
  }
  return labels;
}

/** User id -> display name, for note authors and activity actors. */
export function ownerIndex(owners: PipelineOwnerModel[]): Map<string, string> {
  return new Map(owners.map((owner) => [owner.id, owner.name]));
}
