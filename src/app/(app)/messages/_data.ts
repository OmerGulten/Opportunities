import "server-only";

import type { MessageBusinessOption } from "@/features/messages/components/message-filters";
import type { MessageListRow } from "@/features/messages/components/messages-table";
import type { MessageStatusValue } from "@/features/messages/components/options";
import type { WorkspaceContext } from "@/lib/auth/context";
import { listServices, localizedName } from "@/lib/db/reference";
import { toAppError } from "@/lib/errors";
import type { Locale, MessageChannel } from "@/types/common";
import type { BusinessProviderSnapshotRow, MessageRow } from "@/types/db";

/**
 * Reads for the drafts list.
 *
 * NOTE FOR INTEGRATION: this belongs in `src/features/messages/queries.ts`
 * alongside the other message reads; it lives in the route segment only because
 * the outreach module was built without write access to that file.
 */

export interface MessagesPageQuery {
  channel?: MessageChannel;
  status?: MessageStatusValue;
  businessId?: string;
  limit: number;
  offset: number;
  locale: Locale;
}

export interface MessagesPageData {
  rows: MessageListRow[];
  total: number;
  /** Businesses that already have a draft, for the filter. */
  businesses: MessageBusinessOption[];
}

/** How far back the business filter looks for distinct businesses. */
const BUSINESS_OPTION_SCAN_LIMIT = 500;

export async function loadMessagesPage(ctx: WorkspaceContext, query: MessagesPageQuery): Promise<MessagesPageData> {
  let builder = ctx.supabase
    .from("messages")
    .select("*", { count: "exact" })
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);

  if (query.channel) builder = builder.eq("channel", query.channel);
  if (query.status) builder = builder.eq("status", query.status);
  if (query.businessId) builder = builder.eq("business_id", query.businessId);

  const [{ data: messages, error, count }, { data: recent, error: recentError }, services] = await Promise.all([
    builder.returns<MessageRow[]>(),
    ctx.supabase
      .from("messages")
      .select("business_id")
      .eq("workspace_id", ctx.workspace.id)
      .order("created_at", { ascending: false })
      .limit(BUSINESS_OPTION_SCAN_LIMIT)
      .returns<Array<Pick<MessageRow, "business_id">>>(),
    listServices(ctx.supabase, { activeOnly: false }),
  ]);
  if (error) throw toAppError(error);
  if (recentError) throw toAppError(recentError);

  const optionIds = [...new Set((recent ?? []).map((row) => row.business_id))];
  const pageIds = [...new Set((messages ?? []).map((row) => row.business_id))];
  const names = await loadBusinessNames(ctx, [...new Set([...optionIds, ...pageIds])]);

  const serviceNames = new Map(services.map((service) => [service.id, localizedName(service, query.locale)]));

  const rows: MessageListRow[] = (messages ?? []).map((message) => ({
    id: message.id,
    businessId: message.business_id,
    businessName: names.get(message.business_id) ?? null,
    channel: message.channel,
    status: message.status,
    serviceName: message.service_id ? (serviceNames.get(message.service_id) ?? null) : null,
    subject: message.subject,
    body: message.body,
    createdAt: message.created_at,
  }));

  const businesses: MessageBusinessOption[] = optionIds
    .map((id) => ({ id, name: names.get(id) ?? "" }))
    .filter((option) => option.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, query.locale === "en" ? "en" : "tr"));

  return { rows, total: count ?? 0, businesses };
}

/** Latest provider snapshot name per business; businesses without one stay absent. */
async function loadBusinessNames(ctx: WorkspaceContext, businessIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (businessIds.length === 0) return names;

  const { data, error } = await ctx.supabase
    .from("business_provider_snapshots")
    .select("business_id, display_name, fetched_at")
    .eq("workspace_id", ctx.workspace.id)
    .in("business_id", businessIds)
    // Ascending, so the newest snapshot is the last write into the map.
    .order("fetched_at", { ascending: true })
    .returns<Array<Pick<BusinessProviderSnapshotRow, "business_id" | "display_name" | "fetched_at">>>();
  if (error) throw toAppError(error);

  for (const row of data ?? []) {
    if (row.display_name) names.set(row.business_id, row.display_name);
  }
  return names;
}
