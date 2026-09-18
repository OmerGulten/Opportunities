import type { Metadata } from "next";

import { InlineAlert, PageHeader } from "@/components/shared";
import { CategoriesTable, type AdminCategoryItem } from "@/features/admin/components/categories-table";
import { getRequestLocale, requirePlatformAdmin } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

import { isPlatformDataAvailable, listAllCategories } from "../_data";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  await requirePlatformAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale, "admin");

  if (!isPlatformDataAvailable()) {
    return (
      <>
        <PageHeader title={t("categories.title")} description={t("categories.description")} />
        <InlineAlert tone="neutral" title={t("common.notConfiguredTitle")}>
          {t("common.notConfigured")}
        </InlineAlert>
      </>
    );
  }

  const categories = await listAllCategories();
  const items: AdminCategoryItem[] = categories.map(({ category, mappings }) => ({
    id: category.id,
    key: category.key,
    nameTr: category.name_tr,
    nameEn: category.name_en,
    sortOrder: category.sort_order,
    active: category.active,
    mappings: mappings.map((mapping) => ({
      id: mapping.id,
      provider: mapping.provider,
      providerType: mapping.provider_type,
      queryText: mapping.query_text,
      priority: mapping.priority,
      active: mapping.active,
    })),
  }));

  return (
    <>
      <PageHeader title={t("categories.title")} description={t("categories.description")} />
      <InlineAlert tone="neutral" title={t("common.readOnly")}>
        {t("common.readOnlyHint")}
      </InlineAlert>
      <CategoriesTable items={items} />
    </>
  );
}
