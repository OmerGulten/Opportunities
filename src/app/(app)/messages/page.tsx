import type { Metadata } from "next";
import Link from "next/link";
import { PenLine } from "lucide-react";

import { GoogleAttribution, InlineAlert, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { MessageFilters } from "@/features/messages/components/message-filters";
import { isMessageChannel, isMessageStatus } from "@/features/messages/components/options";
import { MessagesTable } from "@/features/messages/components/messages-table";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

import { loadMessagesPage } from "./_data";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "messages");
  return { title: t("list.title") };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "messages");
  const params = await searchParams;

  const channelParam = firstValue(params.channel);
  const statusParam = firstValue(params.status);
  const businessParam = firstValue(params.businessId);
  const pageParam = Number(firstValue(params.page) ?? "1");
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

  const channel = isMessageChannel(channelParam) ? channelParam : undefined;
  const status = isMessageStatus(statusParam) ? statusParam : undefined;
  const businessId = businessParam && businessParam.length > 0 ? businessParam : undefined;

  const { rows, total, businesses } = await loadMessagesPage(ctx, {
    channel,
    status,
    businessId,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    locale: ctx.locale,
  });

  const filtered = Boolean(channel || status || businessId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("list.title")}
        description={t("list.subtitle")}
        actions={
          <Button render={<Link href="/messages/new" />}>
            <PenLine />
            {t("list.newMessage")}
          </Button>
        }
      />

      <InlineAlert tone="neutral" title={t("neverSends.title")}>
        {t("neverSends.description")}
      </InlineAlert>

      <MessageFilters businesses={businesses} />

      <MessagesTable rows={rows} total={total} page={page} pageSize={PAGE_SIZE} filtered={filtered} />

      {/* Business names come from the provider snapshot, so the attribution belongs here too. */}
      <GoogleAttribution variant="full" />
    </div>
  );
}
