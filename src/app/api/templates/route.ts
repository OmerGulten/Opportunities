import { created, ok, withApi } from "@/lib/api/with-api";
import { createTemplateSchema, listTemplatesQuerySchema } from "@/features/templates/schemas";
import { createTemplate, listTemplates } from "@/features/templates/service";

/** GET /api/templates — built-in, workspace and own personal templates. */
export const GET = withApi(
  async ({ ctx, query }) => {
    const templates = await listTemplates(ctx, query);
    return ok(templates);
  },
  { query: listTemplatesQuerySchema },
);

/** POST /api/templates — creates a workspace or personal template. */
export const POST = withApi(
  async ({ ctx, body }) => {
    const template = await createTemplate(ctx, body);
    return created(template);
  },
  { body: createTemplateSchema },
);
