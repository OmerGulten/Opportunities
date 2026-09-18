import { z } from "zod";

import { created, withApi } from "@/lib/api/with-api";
import { duplicateTemplate } from "@/features/templates/service";

const duplicateSchema = z.object({
  templateId: z.uuid(),
  scope: z.enum(["workspace", "personal"]).default("workspace"),
});

/** POST /api/templates/duplicate — copies a template so a built-in one can be edited. */
export const POST = withApi(
  async ({ ctx, body }) => {
    const template = await duplicateTemplate(ctx, body.templateId, body.scope);
    return created(template);
  },
  { body: duplicateSchema },
);
