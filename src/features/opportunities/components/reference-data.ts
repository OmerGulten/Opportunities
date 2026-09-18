import "server-only";

import { listScans } from "@/features/scans/queries";
import type { WorkspaceContext } from "@/lib/auth/context";
import type { CategoryRow, ServiceRow, WorkspaceServiceRow } from "@/types/db";

import { listOpportunityFacets } from "../queries";

/**
 * Reference data the opportunity/business list filters need.
 *
 * These are small, cacheable reads of reference tables (services, categories)
 * plus the facets query the feature already exposes. They live next to the
 * filter components rather than in the page so both list pages share exactly
 * one loader. Reads go through the RLS-scoped client on the context.
 */

export interface ServiceOption {
  id: string;
  key: string;
  label: string;
  /** `services.icon` value, understood by ServiceIcon/ServiceBadge. */
  icon: string | null;
}

export interface CategoryOption {
  id: string;
  label: string;
}

export interface ScanOption {
  id: string;
  name: string;
  createdAt: string;
}

export interface ListFilterOptions {
  services: ServiceOption[];
  categories: CategoryOption[];
  scans: ScanOption[];
  cities: string[];
  districts: string[];
}

/**
 * Services the workspace sells, falling back to every active service when the
 * workspace has not narrowed its selection yet.
 */
export async function loadServiceOptions(ctx: WorkspaceContext): Promise<ServiceOption[]> {
  const [{ data: services }, { data: workspaceServices }] = await Promise.all([
    ctx.supabase.from("services").select("*").eq("active", true).order("sort_order").returns<ServiceRow[]>(),
    ctx.supabase
      .from("workspace_services")
      .select("*")
      .eq("workspace_id", ctx.workspace.id)
      .eq("enabled", true)
      .returns<WorkspaceServiceRow[]>(),
  ]);

  const enabled = new Set((workspaceServices ?? []).map((row) => row.service_id));
  const rows = (services ?? []).filter((service) => enabled.size === 0 || enabled.has(service.id));

  return rows.map((service) => ({
    id: service.id,
    key: service.key,
    label: ctx.locale === "en" ? service.name_en : service.name_tr,
    icon: service.icon,
  }));
}

/** Everything the filter bar offers as a choice, in one round trip. */
export async function loadFilterOptions(ctx: WorkspaceContext): Promise<ListFilterOptions> {
  const [services, { data: categories }, scans, facets] = await Promise.all([
    loadServiceOptions(ctx),
    ctx.supabase.from("categories").select("*").eq("active", true).order("sort_order").returns<CategoryRow[]>(),
    listScans(ctx, { limit: 50 }),
    listOpportunityFacets(ctx),
  ]);

  return {
    services,
    categories: (categories ?? []).map((category) => ({
      id: category.id,
      label: ctx.locale === "en" ? category.name_en : category.name_tr,
    })),
    scans: scans.items.map((scan) => ({ id: scan.id, name: scan.name, createdAt: scan.created_at })),
    cities: facets.cities,
    districts: facets.districts,
  };
}

/** Category id -> localized label, for list cells. */
export async function loadCategoryLabels(ctx: WorkspaceContext): Promise<Record<string, string>> {
  const { data } = await ctx.supabase.from("categories").select("*").order("sort_order").returns<CategoryRow[]>();
  const map: Record<string, string> = {};
  for (const category of data ?? []) {
    map[category.id] = ctx.locale === "en" ? category.name_en : category.name_tr;
  }
  return map;
}
