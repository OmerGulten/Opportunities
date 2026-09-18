import { created, ok, withApi } from "@/lib/api/with-api";
import { listLeads } from "@/features/pipeline/queries";
import { createLeadSchema, listLeadsQuerySchema } from "@/features/pipeline/schemas";
import { addLead } from "@/features/pipeline/service";

/** GET /api/leads — leads of the workspace. */
export const GET = withApi(
  async ({ ctx, query }) => {
    const result = await listLeads(ctx, query);
    return ok(result);
  },
  { query: listLeadsQuerySchema },
);

/** POST /api/leads — adds a business to the pipeline. */
export const POST = withApi(
  async ({ ctx, body }) => {
    const lead = await addLead(ctx, body);
    return created(lead);
  },
  { body: createLeadSchema },
);
