import { NotFoundError } from "@/lib/errors";
import { ok, withApi } from "@/lib/api/with-api";
import { updateTemplateSchema } from "@/features/templates/schemas";
import { deleteTemplate, getTemplate, updateTemplate } from "@/features/templates/service";

export const GET = withApi(async ({ ctx, params }) => {
  const template = await getTemplate(ctx, String(params.id));
  if (!template) throw new NotFoundError("Template not found");
  return ok(template);
});

/** PATCH /api/templates/:id — built-in templates are read-only; duplicate them instead. */
export const PATCH = withApi(
  async ({ ctx, params, body }) => {
    const template = await updateTemplate(ctx, String(params.id), body);
    return ok(template);
  },
  { body: updateTemplateSchema },
);

export const DELETE = withApi(async ({ ctx, params }) => {
  await deleteTemplate(ctx, String(params.id));
  return ok({ deleted: true });
});
