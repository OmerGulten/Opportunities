"use server";

import { revalidatePath } from "next/cache";

import { createTemplateSchema, updateTemplateSchema } from "@/features/templates/schemas";
import { createTemplate, deleteTemplate, duplicateTemplate, updateTemplate } from "@/features/templates/service";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { AppError, type ErrorCode } from "@/lib/errors";
import { getT } from "@/lib/i18n";
import { createLogger } from "@/lib/logging";

const log = createLogger({ scope: "templates.actions" });

export type TemplateActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } };

export interface SavedTemplate {
  id: string;
  name: string;
}

async function message(key: string): Promise<string> {
  return getT(await getRequestLocale(), "templates")(key);
}

async function failure(scope: string, cause: unknown, fallbackKey: string): Promise<TemplateActionResult<never>> {
  const text = await message(fallbackKey);
  if (cause instanceof AppError) {
    log.warn("action_app_error", { scope, code: cause.code });
    // A forbidden edit means a built-in template: say exactly that.
    const specific = cause.code === "forbidden" ? await message("editor.errors.readOnly") : text;
    return { ok: false, error: { code: cause.code, message: specific } };
  }
  log.error("action_failed", { scope, error: cause instanceof Error ? cause.message : String(cause) });
  return { ok: false, error: { code: "internal_error", message: text } };
}

/**
 * Creates a workspace or personal template.
 *
 * Validation runs against the same schema the API route uses, so a body that
 * references a variable we cannot resolve from verified data is rejected here
 * too rather than silently rendering as empty text later.
 */
export async function createTemplateAction(input: unknown): Promise<TemplateActionResult<SavedTemplate>> {
  const parsed = createTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "validation_error", message: await message("editor.errors.saveFailed") } };
  }

  try {
    const ctx = await requireWorkspaceContext();
    const template = await createTemplate(ctx, parsed.data);
    revalidatePath("/templates");
    return { ok: true, data: { id: template.id, name: template.name } };
  } catch (error) {
    return failure("createTemplate", error, "editor.errors.saveFailed");
  }
}

export async function updateTemplateAction(templateId: string, input: unknown): Promise<TemplateActionResult<SavedTemplate>> {
  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "validation_error", message: await message("editor.errors.saveFailed") } };
  }

  try {
    const ctx = await requireWorkspaceContext();
    const template = await updateTemplate(ctx, templateId, parsed.data);
    revalidatePath("/templates");
    revalidatePath(`/templates/${templateId}`);
    return { ok: true, data: { id: template.id, name: template.name } };
  } catch (error) {
    return failure("updateTemplate", error, "editor.errors.saveFailed");
  }
}

export async function deleteTemplateAction(templateId: string): Promise<TemplateActionResult<{ id: string }>> {
  try {
    const ctx = await requireWorkspaceContext();
    await deleteTemplate(ctx, templateId);
    revalidatePath("/templates");
    return { ok: true, data: { id: templateId } };
  } catch (error) {
    return failure("deleteTemplate", error, "editor.errors.deleteFailed");
  }
}

/** Copies a template (typically a built-in one) so the user can edit their own version. */
export async function duplicateTemplateAction(templateId: string, scope: "workspace" | "personal" = "workspace"): Promise<TemplateActionResult<SavedTemplate>> {
  try {
    const ctx = await requireWorkspaceContext();
    const template = await duplicateTemplate(ctx, templateId, scope);
    revalidatePath("/templates");
    return { ok: true, data: { id: template.id, name: template.name } };
  } catch (error) {
    return failure("duplicateTemplate", error, "editor.errors.duplicateFailed");
  }
}
