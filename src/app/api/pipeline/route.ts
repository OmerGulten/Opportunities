import { ok, withApi } from "@/lib/api/with-api";
import { getPipelineBoard } from "@/features/pipeline/queries";
import { listLeadsQuerySchema } from "@/features/pipeline/schemas";

/** GET /api/pipeline — the whole board: stages, their leads and totals. */
export const GET = withApi(
  async ({ ctx, query }) => {
    const board = await getPipelineBoard(ctx, query);
    return ok(board);
  },
  { query: listLeadsQuerySchema },
);
