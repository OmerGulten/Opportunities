import { created, ok, withApi } from "@/lib/api/with-api";
import { listMessagesQuerySchema, saveMessageSchema } from "@/features/messages/schemas";
import { saveMessage } from "@/features/messages/service";
import { toAppError } from "@/lib/errors";
import type { MessageRow } from "@/types/db";

/** GET /api/messages — drafts for the workspace, newest first. */
export const GET = withApi(
  async ({ ctx, query }) => {
    let builder = ctx.supabase
      .from("messages")
      .select("*", { count: "exact" })
      .eq("workspace_id", ctx.workspace.id)
      .order("created_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (query.businessId) builder = builder.eq("business_id", query.businessId);
    if (query.channel) builder = builder.eq("channel", query.channel);
    if (query.status) builder = builder.eq("status", query.status);

    const { data, error, count } = await builder.returns<MessageRow[]>();
    if (error) throw toAppError(error);
    return ok({ items: data ?? [], total: count ?? 0 });
  },
  { query: listMessagesQuerySchema },
);

/** POST /api/messages — saves a reviewed draft. */
export const POST = withApi(
  async ({ ctx, body }) => {
    const message = await saveMessage(ctx, body);
    return created(message);
  },
  { body: saveMessageSchema },
);
