import type { Metadata } from "next";
import Link from "next/link";
import { Radar } from "lucide-react";

import { DemoBadge, GoogleAttribution, InlineAlert, NotExhaustiveNotice, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ListFilterBar } from "@/features/opportunities/components/filter-bar";
import { OpportunityTable } from "@/features/opportunities/components/opportunity-table";
import { loadCategoryLabels, loadFilterOptions } from "@/features/opportunities/components/reference-data";
import { parseListSearchParams } from "@/features/opportunities/components/search-params";
import { listOpportunities } from "@/features/opportunities/queries";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";
import { getProviderStatus } from "@/lib/providers/registry";

/** Reads session cookies and workspace-scoped data on every request. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "opportunities");
  return { title: t("title") };
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "opportunities");
  const filters = parseListSearchParams(await searchParams);

  const [result, options, categoryLabels] = await Promise.all([
    listOpportunities(ctx, filters),
    loadFilterOptions(ctx),
    loadCategoryLabels(ctx),
  ]);

  const serviceIcons = Object.fromEntries(options.services.map((service) => [service.id, service.icon]));
  const filteredService = filters.serviceId ? (options.services.find((service) => service.id === filters.serviceId) ?? null) : null;
  const providers = getProviderStatus();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            {providers.anyDemo ? <DemoBadge /> : null}
            <Button size="sm" render={<Link href="/scans/new" />}>
              <Radar />
              {t("actions.newScan")}
            </Button>
          </>
        }
      />

      <ListFilterBar options={options} />

      {result.serviceFilterTruncated ? (
        <InlineAlert tone="attention" title={t("notices.truncatedTitle")}>
          {t("notices.truncated")}
        </InlineAlert>
      ) : null}
      {filters.includeIgnored ? <InlineAlert tone="neutral">{t("notices.ignoredIncluded")}</InlineAlert> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">{t("summary.total", { count: result.total })}</p>
        <GoogleAttribution />
      </div>

      <OpportunityTable
        rows={result.items}
        total={result.total}
        categoryLabels={categoryLabels}
        serviceIcons={serviceIcons}
        filteredService={filteredService ? { id: filteredService.id, label: filteredService.label } : null}
      />

      <NotExhaustiveNotice />
    </div>
  );
}
