import { Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { BusinessMarkerItem } from "@/components/map";
import { DemoBadge, PageHeader, Section, StatCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  CoverageNotes,
  ScanActions,
  ScanAreaSummary,
  ScanCoverageMap,
  ScanEvents,
  ScanLiveProgress,
  ScanTargetsTable,
  coverageNotes,
  parseGeoPolygon,
  scanCenter,
  type CoverageCellView,
} from "@/features/scans/components";
import { getScan } from "@/features/scans/queries";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { listCategories, localizedName } from "@/lib/db/reference";
import { getT } from "@/lib/i18n";

/** Counters and events change while the workflow runs. */
export const dynamic = "force-dynamic";

/** Discovered businesses drawn on the coverage map. */
const MAP_BUSINESS_LIMIT = 500;

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "scans");
  return { title: t("detail.title") };
}

export default async function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "scans");
  const { id } = await params;

  const scan = await getScan(ctx, id);
  if (!scan) notFound();

  const [categoryRows, memberships] = await Promise.all([
    listCategories(ctx.supabase, { activeOnly: false }),
    ctx.supabase
      .from("scan_businesses")
      .select("business_id")
      .eq("scan_id", scan.id)
      .limit(MAP_BUSINESS_LIMIT)
      .returns<Array<{ business_id: string }>>(),
  ]);

  const businessIds = (memberships.data ?? []).map((row) => row.business_id);
  const snapshots = businessIds.length
    ? await ctx.supabase
        .from("business_provider_snapshots")
        .select("business_id, display_name, lat, lng")
        .in("business_id", businessIds)
        .returns<Array<{ business_id: string; display_name: string; lat: number | null; lng: number | null }>>()
    : { data: [] as Array<{ business_id: string; display_name: string; lat: number | null; lng: number | null }> };

  const seen = new Set<string>();
  const businesses: BusinessMarkerItem[] = [];
  for (const snapshot of snapshots.data ?? []) {
    if (seen.has(snapshot.business_id) || snapshot.lat === null || snapshot.lng === null) continue;
    seen.add(snapshot.business_id);
    businesses.push({ id: snapshot.business_id, name: snapshot.display_name, location: { lat: snapshot.lat, lng: snapshot.lng } });
  }

  const categoryNames: Record<string, string> = {};
  for (const category of categoryRows) categoryNames[category.id] = localizedName(category, ctx.locale);

  // One circle per coverage cell; the targets table has one row per cell and category.
  const cells: CoverageCellView[] = [];
  const seenCells = new Set<number>();
  for (const target of scan.targets) {
    if (seenCells.has(target.cell_index)) continue;
    seenCells.add(target.cell_index);
    cells.push({ index: target.cell_index, center: { lat: target.center_lat, lng: target.center_lng }, radiusM: target.radius_m });
  }

  const notes = coverageNotes(scan);

  return (
    <>
      <PageHeader
        title={scan.name}
        description={<ScanAreaSummary scan={scan} className="text-sm" />}
        breadcrumbs={[{ label: t("list.title"), href: "/scans" }, { label: scan.name }]}
        actions={
          <>
            {scan.is_demo ? <DemoBadge /> : null}
            <ScanActions scanId={scan.id} scanName={scan.name} status={scan.status} />
            <Button variant="outline" render={<Link href={`/opportunities?scanId=${scan.id}`} />}>
              <Target />
              {t("detail.viewOpportunities", { count: scan.counts.opportunities })}
            </Button>
          </>
        }
      />

      <ScanLiveProgress
        scanId={scan.id}
        initial={{
          status: scan.status,
          percent: scan.progress.percent,
          totalTargets: scan.total_targets,
          discovered: scan.counts.discovered,
          audited: scan.counts.audited,
          scored: scan.counts.scored,
          failed: scan.counts.failed,
          errorCode: scan.error_code,
        }}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title={t("detail.coverageTitle")} description={t("detail.coverageDescription")} className="lg:col-span-2">
          <ScanCoverageMap
            locationMethod={scan.location_method}
            center={scanCenter(scan)}
            radiusM={scan.radius_m}
            polygon={parseGeoPolygon(scan.polygon)}
            cells={cells}
            businesses={businesses}
          />
        </Section>

        <div className="flex flex-col gap-6">
          <Section title={t("detail.creditsTitle")}>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t("credits.estimated")} value={scan.estimated_credits} />
              <StatCard label={t("credits.reserved")} value={scan.reserved_credits} />
              <StatCard label={t("credits.consumed")} value={scan.consumed_credits} />
              <StatCard label={t("credits.refunded")} value={scan.refunded_credits} />
            </div>
            <p className="text-xs text-muted-foreground">{t("credits.note")}</p>
          </Section>

          {notes.length > 0 ? (
            <Section title={t("coverage.title")}>
              <CoverageNotes notes={notes} />
            </Section>
          ) : null}
        </div>
      </div>

      <Section title={t("targets.title")} description={t("targets.description")}>
        <ScanTargetsTable targets={scan.targets} categoryNames={categoryNames} />
      </Section>

      <Section title={t("detail.eventsTitle")} description={t("detail.eventsDescription")}>
        <div className="panel px-4 py-2">
          <ScanEvents events={scan.events} />
        </div>
      </Section>
    </>
  );
}
