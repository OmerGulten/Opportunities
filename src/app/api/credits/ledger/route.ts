import { z } from "zod";

import { ok, withApi } from "@/lib/api/with-api";
import { toAppError } from "@/lib/errors";
import type { CreditLedgerRow } from "@/types/db";

const ledgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  type: z.string().optional(),
});

/** GET /api/credits/ledger — immutable credit history, newest first. */
export const GET = withApi(
  async ({ ctx, query }) => {
    let builder = ctx.supabase
      .from("credit_ledger")
      .select("*", { count: "exact" })
      .eq("workspace_id", ctx.workspace.id)
      .order("created_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);
    if (query.type) builder = builder.eq("type", query.type);

    const { data, error, count } = await builder.returns<CreditLedgerRow[]>();
    if (error) throw toAppError(error);
    return ok({ items: data ?? [], total: count ?? 0 });
  },
  { query: ledgerQuerySchema },
);
