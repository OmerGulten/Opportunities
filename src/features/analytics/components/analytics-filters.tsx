"use client";

import { RotateCcw } from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n/client";

import {
  ANALYTICS_RANGE_PRESETS,
  DEFAULT_ANALYTICS_PRESET,
  resolveAnalyticsRange,
  type AnalyticsRangePreset,
} from "./range";

export interface AnalyticsFilterOption {
  value: string;
  /** Already localized by the server component that read the row. */
  label: string;
}

export interface AnalyticsFiltersProps {
  scans: AnalyticsFilterOption[];
  services: AnalyticsFilterOption[];
  categories: AnalyticsFilterOption[];
}

/** Base UI selects need non-empty item values, so "all" stands in for "no filter". */
const ALL = "all";

/**
 * Filter bar for the analytics page.
 *
 * Every value lives in the URL (nuqs, `shallow: false`) so the Server Component
 * re-runs the query, a filtered view can be shared as a link, and coming back
 * to the page restores exactly what was on screen.
 */
export function AnalyticsFilters({ scans, services, categories }: AnalyticsFiltersProps) {
  const t = useT("analytics");

  const [filters, setFilters] = useQueryStates(
    {
      range: parseAsString.withDefault(DEFAULT_ANALYTICS_PRESET),
      from: parseAsString.withDefault(""),
      to: parseAsString.withDefault(""),
      scan: parseAsString.withDefault(""),
      service: parseAsString.withDefault(""),
      category: parseAsString.withDefault(""),
    },
    { shallow: false, clearOnDefault: true, history: "replace" },
  );

  const resolved = resolveAnalyticsRange({ preset: filters.range, from: filters.from, to: filters.to });
  const isCustom = filters.range === "custom";

  function selectPreset(next: AnalyticsRangePreset) {
    if (next === "custom") {
      // Seed the custom inputs with the window currently on screen.
      void setFilters({ range: "custom", from: resolved.fromDate, to: resolved.toDate });
      return;
    }
    void setFilters({ range: next, from: null, to: null });
  }

  const hasFilters =
    filters.range !== DEFAULT_ANALYTICS_PRESET || Boolean(filters.scan || filters.service || filters.category);

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label={t("filters.preset")} htmlFor="analytics-range">
          <Select
            value={filters.range}
            onValueChange={(value) => {
              if (typeof value === "string") selectPreset(value as AnalyticsRangePreset);
            }}
          >
            <SelectTrigger id="analytics-range" size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANALYTICS_RANGE_PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {t(`filters.presets.${preset}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        {isCustom ? (
          <>
            <FilterField label={t("filters.from")} htmlFor="analytics-from">
              <Input
                id="analytics-from"
                type="date"
                className="h-7 w-40 text-[0.8rem]"
                value={filters.from || resolved.fromDate}
                max={filters.to || resolved.toDate}
                onChange={(event) => void setFilters({ from: event.target.value || null })}
              />
            </FilterField>
            <FilterField label={t("filters.to")} htmlFor="analytics-to">
              <Input
                id="analytics-to"
                type="date"
                className="h-7 w-40 text-[0.8rem]"
                value={filters.to || resolved.toDate}
                min={filters.from || resolved.fromDate}
                onChange={(event) => void setFilters({ to: event.target.value || null })}
              />
            </FilterField>
          </>
        ) : null}

        <FilterField label={t("filters.scan")} htmlFor="analytics-scan">
          <Select
            value={filters.scan || ALL}
            onValueChange={(value) => {
              if (typeof value === "string") void setFilters({ scan: value === ALL ? null : value });
            }}
          >
            <SelectTrigger id="analytics-scan" size="sm" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allScans")}</SelectItem>
              {scans.length === 0 ? (
                <SelectItem value="none" disabled>
                  {t("filters.scansEmpty")}
                </SelectItem>
              ) : null}
              {scans.map((scan) => (
                <SelectItem key={scan.value} value={scan.value}>
                  {scan.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label={t("filters.service")} htmlFor="analytics-service">
          <Select
            value={filters.service || ALL}
            onValueChange={(value) => {
              if (typeof value === "string") void setFilters({ service: value === ALL ? null : value });
            }}
          >
            <SelectTrigger id="analytics-service" size="sm" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allServices")}</SelectItem>
              {services.map((service) => (
                <SelectItem key={service.value} value={service.value}>
                  {service.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label={t("filters.category")} htmlFor="analytics-category">
          <Select
            value={filters.category || ALL}
            onValueChange={(value) => {
              if (typeof value === "string") void setFilters({ category: value === ALL ? null : value });
            }}
          >
            <SelectTrigger id="analytics-category" size="sm" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allCategories")}</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void setFilters({ range: null, from: null, to: null, scan: null, service: null, category: null })}
          >
            <RotateCcw />
            {t("filters.reset")}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{t("filters.hint")}</p>
    </div>
  );
}

function FilterField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
