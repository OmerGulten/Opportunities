"use client";

import { cn } from "cn";
import { ListFilter, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/i18n/client";

import {
  GAP_VALUES,
  INSTAGRAM_FILTER_VALUES,
  PIPELINE_FILTER_VALUES,
  SORT_VALUES,
  WEBSITE_FILTER_VALUES,
  useListFilters,
} from "./filter-state";
import type { ListFilterOptions } from "./reference-data";

/**
 * The filter bar for both list pages.
 *
 * Everything it changes is written to the URL (see `useListFilters`), so the
 * current view can be shared, bookmarked and restored after navigating to a
 * business and back. The server re-parses the same query string with
 * `opportunityFiltersSchema`.
 */

const ALL = "__all";
const SCORE_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90];
const SEARCH_DEBOUNCE_MS = 400;

interface SelectOption {
  value: string;
  label: string;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  // A value that is no longer in the option list (a stale shared URL, a city that
  // left the facets) still has to be visible: the server is filtering on it.
  const items = options.some((option) => option.value === value) ? options : [...options, { value, label: value }];

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
      >
        <SelectTrigger size="sm" className="w-full" aria-label={label}>
          <SelectValue>{(current) => items.find((option) => option.value === current)?.label ?? items[0]?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {items.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface ListFilterBarProps {
  options: ListFilterOptions;
  /** Rendered at the end of the first row (page-level actions). */
  children?: ReactNode;
}

export function ListFilterBar({ options, children }: ListFilterBarProps) {
  const t = useT("opportunities");
  const { filters, setFilter, setRaw, clear, pending } = useListFilters();
  const [searchText, setSearchText] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advancedCount =
    (filters.serviceId ? 1 : 0) +
    (filters.minServiceScore !== null ? 1 : 0) +
    (filters.minScore !== null ? 1 : 0) +
    (filters.maxScore !== null ? 1 : 0) +
    (filters.website !== "any" ? 1 : 0) +
    (filters.instagram !== "any" ? 1 : 0) +
    (filters.pipeline !== "any" ? 1 : 0) +
    (filters.scanId ? 1 : 0) +
    (filters.categoryId ? 1 : 0) +
    (filters.city ? 1 : 0) +
    (filters.district ? 1 : 0) +
    (filters.includeIgnored ? 1 : 0) +
    filters.gaps.length;
  const activeCount = advancedCount + (filters.q ? 1 : 0);

  const [open, setOpen] = useState(advancedCount > 0);

  // Only clears the pending debounce on unmount; no state is written here.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function onSearchChange(value: string) {
    setSearchText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setFilter({ q: value.trim() }), SEARCH_DEBOUNCE_MS);
  }

  function onClear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchText("");
    clear();
  }

  function toggleGap(gap: (typeof GAP_VALUES)[number], checked: boolean) {
    const next = checked ? [...filters.gaps.filter((entry) => entry !== gap), gap] : filters.gaps.filter((entry) => entry !== gap);
    setFilter({ gaps: next });
  }

  const scoreOptions = (all: string): SelectOption[] => [
    { value: ALL, label: all },
    ...SCORE_STEPS.map((step) => ({ value: String(step), label: String(step) })),
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("filters.searchPlaceholder")}
            aria-label={t("filters.search")}
            className="pl-8"
          />
          {pending ? <Spinner className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" /> : null}
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <FilterSelect
            label={t("filters.sort")}
            value={filters.sort}
            options={SORT_VALUES.map((value) => ({ value, label: t(`sort.${value}`) }))}
            onChange={(value) => setRaw({ sort: value as (typeof SORT_VALUES)[number] })}
            className="w-56"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <CollapsibleTrigger
            render={
              <Button variant="outline" size="sm">
                <SlidersHorizontal />
                {open ? t("filters.less") : t("filters.more")}
                {advancedCount > 0 ? <Badge variant="secondary">{advancedCount}</Badge> : null}
              </Button>
            }
          />
          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X />
              {t("filters.clear")}
            </Button>
          ) : null}
          {children}
        </div>
      </div>

      <CollapsibleContent>
        <div className="grid gap-3 rounded-xl border border-border bg-card/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label={t("filters.service")}
            value={filters.serviceId || ALL}
            options={[{ value: ALL, label: t("filters.allServices") }, ...options.services.map((service) => ({ value: service.id, label: service.label }))]}
            onChange={(value) => setFilter({ serviceId: value === ALL ? "" : value, minServiceScore: value === ALL ? null : filters.minServiceScore })}
          />
          <div className="flex flex-col gap-1">
            <FilterSelect
              label={t("filters.minServiceScore")}
              value={filters.minServiceScore === null ? ALL : String(filters.minServiceScore)}
              options={scoreOptions(t("filters.anyScore"))}
              disabled={!filters.serviceId}
              onChange={(value) => setFilter({ minServiceScore: value === ALL ? null : Number(value) })}
            />
            <span className="text-xs text-muted-foreground">{t("filters.minServiceScoreHint")}</span>
          </div>
          <FilterSelect
            label={t("filters.minScore")}
            value={filters.minScore === null ? ALL : String(filters.minScore)}
            options={scoreOptions(t("filters.anyScore"))}
            onChange={(value) => setFilter({ minScore: value === ALL ? null : Number(value) })}
          />
          <FilterSelect
            label={t("filters.maxScore")}
            value={filters.maxScore === null ? ALL : String(filters.maxScore)}
            options={scoreOptions(t("filters.anyScore"))}
            onChange={(value) => setFilter({ maxScore: value === ALL ? null : Number(value) })}
          />

          <FilterSelect
            label={t("filters.website")}
            value={filters.website}
            options={WEBSITE_FILTER_VALUES.map((value) => ({ value, label: t(`website.${value}`) }))}
            onChange={(value) => setFilter({ website: value as (typeof WEBSITE_FILTER_VALUES)[number] })}
          />
          <FilterSelect
            label={t("filters.instagram")}
            value={filters.instagram}
            options={INSTAGRAM_FILTER_VALUES.map((value) => ({ value, label: t(`instagram.${value}`) }))}
            onChange={(value) => setFilter({ instagram: value as (typeof INSTAGRAM_FILTER_VALUES)[number] })}
          />
          <FilterSelect
            label={t("filters.pipeline")}
            value={filters.pipeline}
            options={PIPELINE_FILTER_VALUES.map((value) => ({ value, label: t(`pipelineFilter.${value}`) }))}
            onChange={(value) => setFilter({ pipeline: value as (typeof PIPELINE_FILTER_VALUES)[number] })}
          />

          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t("filters.gaps")}</span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-1.5">
                      <ListFilter />
                      {filters.gaps.length > 0 ? t("filters.gapsSelected", { count: filters.gaps.length }) : t("filters.gapsAny")}
                    </span>
                  </Button>
                }
              />
              <DropdownMenuContent className="w-64">
                <DropdownMenuLabel>{t("filters.gapsHint")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {GAP_VALUES.map((gap) => (
                  <DropdownMenuCheckboxItem
                    key={gap}
                    checked={filters.gaps.includes(gap)}
                    onCheckedChange={(checked) => toggleGap(gap, checked === true)}
                    closeOnClick={false}
                  >
                    {t(`gaps.${gap}`)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <FilterSelect
            label={t("filters.category")}
            value={filters.categoryId || ALL}
            options={[{ value: ALL, label: t("filters.allCategories") }, ...options.categories.map((category) => ({ value: category.id, label: category.label }))]}
            onChange={(value) => setFilter({ categoryId: value === ALL ? "" : value })}
          />
          <FilterSelect
            label={t("filters.city")}
            value={filters.city || ALL}
            options={[{ value: ALL, label: t("filters.allCities") }, ...options.cities.map((city) => ({ value: city, label: city }))]}
            onChange={(value) => setFilter({ city: value === ALL ? "" : value })}
          />
          <FilterSelect
            label={t("filters.district")}
            value={filters.district || ALL}
            options={[{ value: ALL, label: t("filters.allDistricts") }, ...options.districts.map((district) => ({ value: district, label: district }))]}
            onChange={(value) => setFilter({ district: value === ALL ? "" : value })}
          />
          <FilterSelect
            label={t("filters.scan")}
            value={filters.scanId || ALL}
            options={[{ value: ALL, label: t("filters.allScans") }, ...options.scans.map((scan) => ({ value: scan.id, label: scan.name }))]}
            onChange={(value) => setFilter({ scanId: value === ALL ? "" : value })}
          />

          <label className="flex items-center gap-2 self-end pb-1 text-sm">
            <Switch checked={filters.includeIgnored} onCheckedChange={(checked) => setFilter({ includeIgnored: checked === true })} />
            <span>{t("filters.includeIgnored")}</span>
          </label>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
