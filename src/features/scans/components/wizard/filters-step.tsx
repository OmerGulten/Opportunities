"use client";

import { InlineAlert } from "@/components/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/i18n/client";

import type { ScanFormApi } from "./types";

const WEBSITE_OPTIONS = ["any", "none", "weak", "strong"] as const;
const INSTAGRAM_OPTIONS = ["any", "not_found", "found", "not_checked"] as const;
const GOOGLE_OPTIONS = ["incomplete", "low_reviews", "low_rating", "missing_hours", "missing_photos", "missing_website"] as const;

type GoogleFilter = (typeof GOOGLE_OPTIONS)[number];

export interface FiltersStepProps {
  form: ScanFormApi;
  /** Competitor benchmark is behind a platform feature flag. */
  benchmarkEnabled: boolean;
  errorMessage: string | null;
}

/**
 * Step 5 — optional filters. They exclude businesses from the results; the
 * cheap ones run on the provider profile before any paid audit work, the rest
 * after the audit. At `discovery` depth the underlying fields are never
 * requested, so the filters are skipped rather than guessed.
 */
export function FiltersStep({ form, benchmarkEnabled, errorMessage }: FiltersStepProps) {
  const t = useT("scans");
  const depth = form.watch("auditDepth") ?? "basic";
  const filters = form.watch("filters");
  const website = filters?.website ?? "any";
  const instagram = filters?.instagram ?? "any";
  const google = filters?.google ?? [];
  const includeBenchmark = filters?.includeBenchmark ?? false;

  function updateFilters(patch: Partial<NonNullable<typeof filters>>) {
    const current = form.getValues("filters") ?? {};
    form.setValue("filters", { ...current, ...patch }, { shouldValidate: true, shouldDirty: true });
  }

  function toggleGoogle(option: GoogleFilter) {
    const next = google.includes(option) ? google.filter((entry) => entry !== option) : [...google, option];
    updateFilters({ google: next });
  }

  return (
    <div className="flex flex-col gap-5">
      {depth === "discovery" ? <InlineAlert tone="attention">{t("wizard.filters.discoveryNote")}</InlineAlert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="filter-website">{t("wizard.filters.website")}</FieldLabel>
          <Select
            value={website}
            onValueChange={(value) => {
              if (isWebsiteOption(value)) updateFilters({ website: value });
            }}
          >
            <SelectTrigger id="filter-website" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEBSITE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`wizard.filters.websiteOptions.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{t("wizard.filters.websiteHint")}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="filter-instagram">{t("wizard.filters.instagram")}</FieldLabel>
          <Select
            value={instagram}
            onValueChange={(value) => {
              if (isInstagramOption(value)) updateFilters({ instagram: value });
            }}
          >
            <SelectTrigger id="filter-instagram" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSTAGRAM_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`wizard.filters.instagramOptions.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{t("wizard.filters.instagramHint")}</FieldDescription>
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("wizard.filters.googleGaps")}</legend>
        <p className="text-xs text-muted-foreground">{t("wizard.filters.googleGapsHint")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {GOOGLE_OPTIONS.map((option) => (
            <Label key={option} className="flex items-start gap-2 rounded-lg border border-border p-2.5 text-sm font-normal">
              <Checkbox checked={google.includes(option)} onCheckedChange={() => toggleGoogle(option)} />
              <span className="min-w-0">
                <span className="block font-medium">{t(`wizard.filters.googleOptions.${option}.label`)}</span>
                <span className="block text-xs text-muted-foreground">{t(`wizard.filters.googleOptions.${option}.hint`)}</span>
              </span>
            </Label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="filter-min-reviews">{t("wizard.filters.minReviews")}</FieldLabel>
          <NumberInput
            id="filter-min-reviews"
            value={filters?.minReviews ?? null}
            min={0}
            step={1}
            onChange={(value) => updateFilters({ minReviews: value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="filter-max-reviews">{t("wizard.filters.maxReviews")}</FieldLabel>
          <NumberInput
            id="filter-max-reviews"
            value={filters?.maxReviews ?? null}
            min={0}
            step={1}
            onChange={(value) => updateFilters({ maxReviews: value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="filter-min-rating">{t("wizard.filters.minRating")}</FieldLabel>
          <NumberInput
            id="filter-min-rating"
            value={filters?.minRating ?? null}
            min={0}
            max={5}
            step={0.1}
            onChange={(value) => updateFilters({ minRating: value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="filter-max-rating">{t("wizard.filters.maxRating")}</FieldLabel>
          <NumberInput
            id="filter-max-rating"
            value={filters?.maxRating ?? null}
            min={0}
            max={5}
            step={0.1}
            onChange={(value) => updateFilters({ maxRating: value })}
          />
        </Field>
      </div>

      <Field orientation="horizontal" className="rounded-lg border border-border p-3">
        <Switch
          id="filter-benchmark"
          checked={includeBenchmark && benchmarkEnabled}
          disabled={!benchmarkEnabled}
          onCheckedChange={(checked) => updateFilters({ includeBenchmark: checked })}
        />
        <div className="min-w-0">
          <FieldLabel htmlFor="filter-benchmark">{t("wizard.filters.benchmark")}</FieldLabel>
          <FieldDescription>
            {benchmarkEnabled ? t("wizard.filters.benchmarkHint") : t("wizard.filters.benchmarkDisabled")}
          </FieldDescription>
        </div>
      </Field>

      <FieldError>{errorMessage}</FieldError>
    </div>
  );
}

function NumberInput({
  id,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={value === null ? "" : String(value)}
      onChange={(event) => {
        const raw = event.target.value.trim();
        if (raw === "") {
          onChange(null);
          return;
        }
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
    />
  );
}

function isWebsiteOption(value: unknown): value is (typeof WEBSITE_OPTIONS)[number] {
  return typeof value === "string" && (WEBSITE_OPTIONS as readonly string[]).includes(value);
}

function isInstagramOption(value: unknown): value is (typeof INSTAGRAM_OPTIONS)[number] {
  return typeof value === "string" && (INSTAGRAM_OPTIONS as readonly string[]).includes(value);
}
