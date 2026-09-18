import { NotFoundError } from "@/lib/errors";
import { ok, withApi } from "@/lib/api/with-api";
import { getLead } from "@/features/pipeline/queries";
import { updateLeadSchema } from "@/features/pipeline/schemas";
import { removeLead, updateLead } from "@/features/pipeline/service";

/** GET /api/leads/:id — lead with its notes and activity timeline. */
export const GET = withApi(async ({ ctx, params }) => {
  const lead = await getLead(ctx, String(params.id));
  if (!lead) throw new NotFoundError("Lead not found");
  return ok(lead);
});

/** PATCH /api/leads/:id — stage moves, ownership, values and follow-up dates. */
export const PATCH = withApi(
  async ({ ctx, params, body }) => {
    const lead = await updateLead(ctx, String(params.id), body);
    return ok(lead);
  },
  { body: updateLeadSchema },
);

/** DELETE /api/leads/:id — removes the lead, keeping the business and its audits. */
export const DELETE = withApi(async ({ ctx, params }) => {
  await removeLead(ctx, String(params.id));
  return ok({ deleted: true });
});
