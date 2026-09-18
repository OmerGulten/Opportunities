import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { InlineAlert, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { isMessageChannel } from "@/features/messages/components/options";
import { TemplateFilters, TEMPLATE_FILTER_NO_SERVICE } from "@/features/templates/components/template-filters";
import { TemplateList, type TemplateCardData } from "@/features/templates/components/template-list";
import { listTemplates } from "@/features/templates/service";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { listCategories, listServices, localizedName } from "@/lib/db/reference";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "templates");
  return { title: t("title") };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "templates");
  const params = await searchParams;

  const channelParam = firstValue(params.channel);
  const channel = isMessageChannel(channelParam) ? channelParam : undefined;
  const serviceParam = firstValue(params.serviceId);
  const search = (firstValue(params.q) ?? "").trim().toLocaleLowerCase(ctx.locale === "en" ? "en" : "tr");

  const [rows, services, categories] = await Promise.all([
    // Inactive templates stay visible here (and are badged): hiding them would
    // look like they had been deleted.
    listTemplates(ctx, { activeOnly: false, channel }),
    listServices(ctx.supabase, { activeOnly: false }),
    listCategories(ctx.supabase, { activeOnly: false }),
  ]);

  const serviceNames = new Map(services.map((service) => [service.id, localizedName(service, ctx.locale)]));
  const categoryNames = new Map(categories.map((category) => [category.id, localizedName(category, ctx.locale)]));

  const filteredRows = rows.filter((row) => {
    if (serviceParam === TEMPLATE_FILTER_NO_SERVICE && row.service_id !== null) return false;
    if (serviceParam && serviceParam !== TEMPLATE_FILTER_NO_SERVICE && row.service_id !== serviceParam) return false;
    if (search.length > 0) {
      const haystack = `${row.name}\n${row.subject ?? ""}\n${row.body}`.toLocaleLowerCase(ctx.locale === "en" ? "en" : "tr");
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const templates: TemplateCardData[] = filteredRows.map((row) => ({
    id: row.id,
    name: row.name,
    scope: row.scope,
    channel: row.channel,
    serviceName: row.service_id ? (serviceNames.get(row.service_id) ?? null) : null,
    categoryName: row.category_id ? (categoryNames.get(row.category_id) ?? null) : null,
    locale: row.locale,
    tone: row.tone,
    subject: row.subject,
    body: row.body,
    variables: row.variables ?? [],
    usageCount: row.usage_count,
    active: row.active,
    updatedAt: row.updated_at,
  }));

  const filtered = Boolean(channel || serviceParam || search.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button render={<Link href="/templates/new" />}>
            <Plus />
            {t("actions.new")}
          </Button>
        }
      />

      <InlineAlert tone="neutral" title={t("readOnly")}>
        {t("readOnlyHint")}
      </InlineAlert>

      <TemplateFilters services={services.map((service) => ({ id: service.id, name: localizedName(service, ctx.locale) }))} />

      <TemplateList templates={templates} filtered={filtered} />
    </div>
  );
}
