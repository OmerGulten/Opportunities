import type { Metadata } from "next";

import { PageHeader } from "@/components/shared";
import { NewScanWizard, type CategoryOption, type ScanLimits, type ServiceOption } from "@/features/scans/components";
import { getRequestLocale, requireWorkspaceContext } from "@/lib/auth/context";
import { listCategories, listServices, localizedDescription, localizedName } from "@/lib/db/reference";
import { getFeatureFlags, getScanSettings } from "@/lib/db/settings";
import { getT } from "@/lib/i18n";
import { getProviderStatus } from "@/lib/providers/registry";

/** Reads workspace settings and the credit balance on every request. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale(), "scans");
  return { title: t("wizard.title") };
}

export default async function NewScanPage() {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "scans");

  // The wizard is a Client Component, so its reference data is resolved here.
  // A dedicated `listScanFormOptions` query in features/scans/queries.ts would
  // be the natural home for this once that file can be extended.
  const [categoryRows, serviceRows, workspaceServices, settings, flags] = await Promise.all([
    listCategories(ctx.supabase),
    listServices(ctx.supabase),
    ctx.supabase
      .from("workspace_services")
      .select("service_id, enabled")
      .eq("workspace_id", ctx.workspace.id)
      .returns<Array<{ service_id: string; enabled: boolean }>>(),
    getScanSettings(),
    getFeatureFlags(),
  ]);

  const selections = workspaceServices.data ?? [];
  const enabledIds = new Set(selections.filter((row) => row.enabled).map((row) => row.service_id));
  // A workspace that never saved a selection may sell everything the platform offers.
  const offeredServices = selections.length === 0 ? serviceRows : serviceRows.filter((service) => enabledIds.has(service.id));

  const categories: CategoryOption[] = categoryRows.map((category) => ({
    id: category.id,
    key: category.key,
    name: localizedName(category, ctx.locale),
    icon: category.icon,
  }));

  const services: ServiceOption[] = offeredServices.map((service) => ({
    id: service.id,
    key: service.key,
    name: localizedName(service, ctx.locale),
    description: localizedDescription(service, ctx.locale),
    icon: service.icon,
  }));

  const limits: ScanLimits = {
    maxBusinesses: settings.max_businesses_per_scan,
    minRadiusM: settings.min_radius_m,
    maxRadiusM: settings.max_radius_m,
    maxPolygonAreaKm2: settings.max_polygon_area_km2,
    defaultCellRadiusM: settings.default_cell_radius_m,
  };

  return (
    <>
      <PageHeader
        title={t("wizard.title")}
        description={t("wizard.description")}
        breadcrumbs={[
          { label: t("list.title"), href: "/scans" },
          { label: t("wizard.title") },
        ]}
      />
      <NewScanWizard
        categories={categories}
        services={services}
        limits={limits}
        benchmarkEnabled={flags.competitor_benchmark}
        isDemo={getProviderStatus().places.demo}
      />
    </>
  );
}
