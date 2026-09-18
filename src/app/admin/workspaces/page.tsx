import type { Metadata } from "next";

import { InlineAlert, PageHeader } from "@/components/shared";
import { listWorkspacesQuerySchema } from "@/features/admin/schemas";
import { listWorkspaces } from "@/features/admin/service";
import { WorkspacesTable, type AdminWorkspaceListItem } from "@/features/admin/components/workspaces-table";
import { getRequestLocale, requirePlatformAdmin } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

import { isPlatformDataAvailable } from "../_data";

export const metadata: Metadata = { title: "Workspaces" };

const PAGE_SIZE = 25;

interface PageSearchParams {
  q?: string | string[];
  page?: string | string[];
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminWorkspacesPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const ctx = await requirePlatformAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale, "admin");

  const params = await searchParams;
  const rawQuery = first(params.q)?.trim() ?? "";
  const requestedPage = Number.parseInt(first(params.page) ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  if (!isPlatformDataAvailable()) {
    return (
      <>
        <PageHeader title={t("workspaces.title")} description={t("workspaces.description")} />
        <InlineAlert tone="neutral" title={t("common.notConfiguredTitle")}>
          {t("common.notConfigured")}
        </InlineAlert>
      </>
    );
  }

  // Re-validated server side: the URL is user input like any other.
  const query = listWorkspacesQuerySchema.parse({
    ...(rawQuery === "" ? {} : { q: rawQuery }),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const { items, total } = await listWorkspaces(ctx, query);

  const rows: AdminWorkspaceListItem[] = items.map((item) => ({
    id: item.workspace.id,
    name: item.workspace.name,
    slug: item.workspace.slug,
    planKey: item.planKey,
    memberCount: item.memberCount,
    available: item.credits.available,
    reserved: item.credits.reserved,
    lifetimeConsumed: item.credits.lifetimeConsumed,
    unlimited: item.credits.unlimited,
    scans: item.scans,
    businesses: item.businesses,
    createdAt: item.workspace.created_at,
  }));

  return (
    <>
      <PageHeader title={t("workspaces.title")} description={t("workspaces.description")} />
      <WorkspacesTable items={rows} total={total} page={page} pageSize={PAGE_SIZE} query={rawQuery} />
    </>
  );
}
