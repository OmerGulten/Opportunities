import "server-only";

import type { WorkspaceContext } from "@/lib/auth/context";
import { extractVariables } from "@/features/messages/variables";
import { ForbiddenError, NotFoundError, toAppError } from "@/lib/errors";
import type { MessageTemplateRow } from "@/types/db";

import type { CreateTemplateRequest, ListTemplatesQuery, UpdateTemplateRequest } from "./schemas";

/**
 * Template management.
 *
 * Three scopes share one table: seeded `system` templates everyone can read,
 * `workspace` templates the team shares, and `personal` templates private to
 * their author. RLS enforces that split; these helpers keep the API honest about
 * it and refuse edits to system templates.
 */

export async function listTemplates(ctx: WorkspaceContext, query: ListTemplatesQuery = { activeOnly: true }): Promise<MessageTemplateRow[]> {
  let builder = ctx.supabase
    .from("message_templates")
    .select("*")
    .or(`scope.eq.system,workspace_id.eq.${ctx.workspace.id}`)
    .order("scope")
    .order("name");

  if (query.activeOnly !== false) builder = builder.eq("active", true);
  if (query.channel) builder = builder.eq("channel", query.channel);
  if (query.serviceId) builder = builder.eq("service_id", query.serviceId);
  if (query.scope) builder = builder.eq("scope", query.scope);
  if (query.locale) builder = builder.eq("locale", query.locale);

  const { data, error } = await builder.returns<MessageTemplateRow[]>();
  if (error) throw toAppError(error);

  // A personal template belongs to one user even though it lives in the shared table.
  return (data ?? []).filter((template) => template.scope !== "personal" || template.owner_id === ctx.user.id);
}

export async function getTemplate(ctx: WorkspaceContext, templateId: string): Promise<MessageTemplateRow | null> {
  const { data, error } = await ctx.supabase.from("message_templates").select("*").eq("id", templateId).maybeSingle<MessageTemplateRow>();
  if (error) throw toAppError(error);
  if (!data) return null;
  if (data.scope === "personal" && data.owner_id !== ctx.user.id) return null;
  if (data.scope === "workspace" && data.workspace_id !== ctx.workspace.id) return null;
  return data;
}

export async function createTemplate(ctx: WorkspaceContext, request: CreateTemplateRequest): Promise<MessageTemplateRow> {
  const { data, error } = await ctx.supabase
    .from("message_templates")
    .insert({
      workspace_id: ctx.workspace.id,
      owner_id: request.scope === "personal" ? ctx.user.id : null,
      scope: request.scope,
      name: request.name,
      channel: request.channel,
      service_id: request.serviceId ?? null,
      category_id: request.categoryId ?? null,
      tone: request.tone,
      locale: request.locale,
      subject: request.subject ?? null,
      body: request.body,
      variables: extractVariables(request.body),
      active: request.active,
    })
    .select("*")
    .single<MessageTemplateRow>();
  if (error || !data) throw toAppError(error ?? new Error("Template could not be created"));
  return data;
}

export async function updateTemplate(ctx: WorkspaceContext, templateId: string, request: UpdateTemplateRequest): Promise<MessageTemplateRow> {
  const existing = await getTemplate(ctx, templateId);
  if (!existing) throw new NotFoundError("Template not found");
  // Seeded templates are shared platform content; users copy them instead.
  if (existing.scope === "system") throw new ForbiddenError("Built-in templates cannot be edited. Duplicate it first.");

  const patch: Record<string, unknown> = {};
  if (request.name !== undefined) patch.name = request.name;
  if (request.channel !== undefined) patch.channel = request.channel;
  if (request.serviceId !== undefined) patch.service_id = request.serviceId;
  if (request.categoryId !== undefined) patch.category_id = request.categoryId;
  if (request.tone !== undefined) patch.tone = request.tone;
  if (request.locale !== undefined) patch.locale = request.locale;
  if (request.subject !== undefined) patch.subject = request.subject;
  if (request.active !== undefined) patch.active = request.active;
  if (request.body !== undefined) {
    patch.body = request.body;
    patch.variables = extractVariables(request.body);
  }

  const { data, error } = await ctx.supabase.from("message_templates").update(patch).eq("id", templateId).select("*").single<MessageTemplateRow>();
  if (error || !data) throw toAppError(error ?? new Error("Template could not be updated"));
  return data;
}

export async function deleteTemplate(ctx: WorkspaceContext, templateId: string): Promise<void> {
  const existing = await getTemplate(ctx, templateId);
  if (!existing) throw new NotFoundError("Template not found");
  if (existing.scope === "system") throw new ForbiddenError("Built-in templates cannot be deleted");

  const { error } = await ctx.supabase.from("message_templates").delete().eq("id", templateId);
  if (error) throw toAppError(error);
}

/** Copies a template (typically a built-in one) into the workspace for editing. */
export async function duplicateTemplate(ctx: WorkspaceContext, templateId: string, scope: "workspace" | "personal" = "workspace"): Promise<MessageTemplateRow> {
  const source = await getTemplate(ctx, templateId);
  if (!source) throw new NotFoundError("Template not found");

  return createTemplate(ctx, {
    name: `${source.name} (copy)`,
    channel: source.channel,
    scope,
    serviceId: source.service_id,
    categoryId: source.category_id,
    tone: source.tone as CreateTemplateRequest["tone"],
    locale: source.locale,
    subject: source.subject,
    body: source.body,
    active: true,
  });
}
