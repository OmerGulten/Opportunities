"use client";

import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";

import { CategoryIcon } from "./category-icon";
import { OptionCard } from "./option-card";
import type { CategoryOption, ScanFormApi } from "./types";

/** Schema ceiling (`createScanSchema.categoryIds`). */
const MAX_CATEGORIES = 10;

export interface CategoriesStepProps {
  form: ScanFormApi;
  categories: CategoryOption[];
  errorMessage: string | null;
}

/**
 * Step 2 — which business categories to look for. Each category becomes its own
 * provider search per coverage cell, so the selection drives both the cost and
 * the number of results.
 */
export function CategoriesStep({ form, categories, errorMessage }: CategoriesStepProps) {
  const t = useT("scans");
  const selected = form.watch("categoryIds") ?? [];
  const atLimit = selected.length >= MAX_CATEGORIES;

  function toggle(categoryId: string) {
    const next = selected.includes(categoryId)
      ? selected.filter((id) => id !== categoryId)
      : selected.length >= MAX_CATEGORIES
        ? selected
        : [...selected, categoryId];
    form.setValue("categoryIds", next, { shouldValidate: true, shouldDirty: true });
  }

  if (categories.length === 0) {
    return <EmptyState title={t("wizard.categories.emptyTitle")} description={t("wizard.categories.emptyBody")} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("wizard.categories.selectedCount", { count: selected.length, max: MAX_CATEGORIES })}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={selected.length === 0}
          onClick={() => form.setValue("categoryIds", [], { shouldValidate: true, shouldDirty: true })}
        >
          {t("wizard.categories.clear")}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {categories.map((category) => {
          const isSelected = selected.includes(category.id);
          return (
            <OptionCard
              key={category.id}
              selected={isSelected}
              disabled={!isSelected && atLimit}
              onToggle={() => toggle(category.id)}
              icon={<CategoryIcon icon={category.icon} />}
              title={category.name}
            />
          );
        })}
      </div>

      {atLimit ? <p className="text-xs text-muted-foreground">{t("wizard.categories.limitReached", { max: MAX_CATEGORIES })}</p> : null}
      <FieldError>{errorMessage}</FieldError>
    </div>
  );
}
