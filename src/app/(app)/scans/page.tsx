import { Radar } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DemoBadge, PageHeader, Section } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ScanFilters, ScanListTable, ScanPagination, isScanStatusFilter } from "@/features/scans/components";
import { listScans } from "@/features/scans/queries";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";
import { getProviderStatus } from "@/lib/providers/registry";
import type { ScanStatus } from "@/types/common";

/** Scan counters change while a workflow runs, so the list is never cached. */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "scans");
  return { title: t("list.title") };
}

export default async function ScansPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "scans");
  const params = await searchParams;

  const statusParam = firstParam(params.status);
  const status = isScanStatusFilter(statusParam) && statusParam !== "all" ? (statusParam as ScanStatus | "active" | "terminal") : undefined;
  const page = parsePage(firstParam(params.page));

  const { items, total } = await listScans(ctx, { status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const providers = getProviderStatus();

  return (
    <>
      <PageHeader
        title={t("list.title")}
        description={t("list.description")}
        actions={
          <>
            {providers.places.demo ? <DemoBadge /> : null}
            <Button render={<Link href="/scans/new" />}>
              <Radar />
              {t("list.newScan")}
            </Button>
          </>
        }
      />

      <Section
        description={total > 0 ? t("list.count", { count: total }) : undefined}
        actions={<ScanFilters />}
        headerClassName="sm:items-end"
      >
        <ScanListTable scans={items} />
        <ScanPagination page={page} pageSize={PAGE_SIZE} total={total} />
      </Section>
    </>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
