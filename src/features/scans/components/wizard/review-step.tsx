"use client";

import { Badge } from "@/components/ui/badge";
import { DemoBadge, KeyValueList, ServiceIcon, type KeyValueItem } from "@/components/shared";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatLatLng, ringOf } from "@/components/map";
import { useFormatters, useT } from "@/lib/i18n/client";

import { CreditEstimatePanel, type EstimateStatus } from "../credit-estimate-panel";
import type { ScanEstimateState } from "./use-scan-estimate";
import { CategoryIcon } from "./category-icon";
import type { CategoryOption, ScanFormApi, ServiceOption } from "./types";

export interface ReviewStepProps {
  form: ScanFormApi;
  categories: CategoryOption[];
  services: ServiceOption[];
  estimate: ScanEstimateState;
  isDemo: boolean;
}

/** Step 6 — everything the scan will do, and what it will cost, before it starts. */
export function ReviewStep({ form, categories, services, estimate, isDemo }: ReviewStepProps) {
  const t = useT("scans");
  const tc = useT("common");
  const { number } = useFormatters();

  const values = form.watch();
  const selectedCategories = categories.filter((category) => (values.categoryIds ?? []).includes(category.id));
  const selectedServices = services.filter((service) => (values.serviceIds ?? []).includes(service.id));
  const vertices = ringOf(values.polygon ?? null);
  const filters = values.filters;

  const areaItems: KeyValueItem[] = [
    {
      key: "method",
      label: t("wizard.location.method"),
      value: t(`wizard.location.methods.${values.locationMethod}.label`),
    },
    ...(values.locationMethod === "polygon"
      ? [{ key: "vertices", label: t("wizard.location.vertices"), value: number(vertices.length) }]
      : [
          {
            key: "center",
            label: t("wizard.location.center"),
            value: values.center ? formatLatLng(values.center) : t("wizard.location.noCenter"),
          },
          {
            key: "radius",
            label: t("wizard.location.radius"),
            value: values.radiusM ? `${number(values.radiusM)} ${tc("units.m")}` : tc("states.unknown"),
          },
        ]),
    ...(values.placeLabel ? [{ key: "place", label: t("wizard.location.place"), value: values.placeLabel }] : []),
    { key: "depth", label: t("wizard.depth.title"), value: t(`wizard.depth.options.${values.auditDepth ?? "basic"}.label`) },
    { key: "maxBusinesses", label: t("wizard.depth.maxBusinesses"), value: number(values.maxBusinesses ?? 0) },
  ];

  const filterItems: KeyValueItem[] = [
    { key: "website", label: t("wizard.filters.website"), value: t(`wizard.filters.websiteOptions.${filters?.website ?? "any"}`) },
    { key: "instagram", label: t("wizard.filters.instagram"), value: t(`wizard.filters.instagramOptions.${filters?.instagram ?? "any"}`) },
    {
      key: "google",
      label: t("wizard.filters.googleGaps"),
      value:
        (filters?.google ?? []).length === 0
          ? t("wizard.review.noFilter")
          : (filters?.google ?? []).map((option) => t(`wizard.filters.googleOptions.${option}.label`)).join(", "),
    },
    {
      key: "reviews",
      label: t("wizard.review.reviewRange"),
      value: formatRange(filters?.minReviews ?? null, filters?.maxReviews ?? null, number, t("wizard.review.noFilter")),
    },
    {
      key: "rating",
      label: t("wizard.review.ratingRange"),
      value: formatRange(filters?.minRating ?? null, filters?.maxRating ?? null, number, t("wizard.review.noFilter")),
    },
    {
      key: "benchmark",
      label: t("wizard.filters.benchmark"),
      value: filters?.includeBenchmark ? t("wizard.review.included") : t("wizard.review.notIncluded"),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel htmlFor="scan-name">{t("wizard.review.nameLabel")}</FieldLabel>
        <Input
          id="scan-name"
          placeholder={values.placeLabel ?? t("wizard.review.namePlaceholder")}
          {...form.register("name", { setValueAs: (value: string) => (typeof value === "string" && value.trim() === "" ? undefined : value) })}
        />
        <FieldDescription>{t("wizard.review.nameHint")}</FieldDescription>
      </Field>

      {isDemo ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-600/25 bg-amber-500/10 p-3 text-xs">
          <DemoBadge />
          <span className="text-muted-foreground">{t("wizard.review.demoNote")}</span>
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("wizard.review.areaTitle")}</h3>
        <KeyValueList items={areaItems} />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("wizard.review.selectionTitle")}</h3>
        <div className="flex flex-wrap gap-1.5">
          {selectedCategories.map((category) => (
            <Badge key={category.id} variant="outline" className="gap-1 font-normal">
              <CategoryIcon icon={category.icon} className="size-3" />
              {category.name}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {selectedServices.map((service) => (
            <Badge key={service.id} variant="outline" className="gap-1 font-normal">
              <ServiceIcon icon={service.icon} colored className="size-3" />
              {service.name}
            </Badge>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("wizard.review.filtersTitle")}</h3>
        <KeyValueList items={filterItems} />
      </section>

      <CreditEstimatePanel
        estimate={estimate.estimate}
        status={estimate.status as EstimateStatus}
        errorCode={estimate.errorCode}
        variant="full"
      />
    </div>
  );
}

function formatRange(
  min: number | null,
  max: number | null,
  number: (value: number, options?: Intl.NumberFormatOptions) => string,
  emptyLabel: string,
): string {
  if (min === null && max === null) return emptyLabel;
  if (min !== null && max !== null) return `${number(min)} – ${number(max)}`;
  if (min !== null) return `≥ ${number(min)}`;
  return `≤ ${number(max ?? 0)}`;
}
