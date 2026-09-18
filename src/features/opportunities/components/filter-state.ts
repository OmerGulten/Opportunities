"use client";

import { parseAsArrayOf, parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useCallback, useTransition } from "react";

/**
 * URL state for the opportunity and business lists.
 *
 * Every filter lives in the query string so a filtered view can be shared and
 * survives navigating to a business and back. The keys match
 * `opportunityFiltersSchema` exactly, which is what the server re-parses.
 */

export const SORT_VALUES = [
  "score_desc",
  "score_asc",
  "name_asc",
  "name_desc",
  "recent",
  "reviews_desc",
  "rating_asc",
  "last_contacted",
] as const;

export const WEBSITE_FILTER_VALUES = ["any", "found", "not_found", "unreachable", "invalid", "not_checked"] as const;

export const INSTAGRAM_FILTER_VALUES = ["any", "found", "not_found", "not_checked", "unavailable", "ambiguous"] as const;

export const PIPELINE_FILTER_VALUES = ["any", "none", "in_pipeline", "contacted", "not_contacted", "won", "lost"] as const;

export const GAP_VALUES = [
  "no_website",
  "weak_website",
  "no_https",
  "no_instagram",
  "inactive_instagram",
  "google_incomplete",
  "low_reviews",
  "low_rating",
  "missing_hours",
  "few_photos",
  "slow_mobile",
  "unanswered_reviews",
] as const;

export const PAGE_SIZE_OPTIONS = [25, 50, 100];

export const listFilterParsers = {
  q: parseAsString.withDefault(""),
  scanId: parseAsString.withDefault(""),
  serviceId: parseAsString.withDefault(""),
  categoryId: parseAsString.withDefault(""),
  city: parseAsString.withDefault(""),
  district: parseAsString.withDefault(""),
  minScore: parseAsInteger,
  maxScore: parseAsInteger,
  minServiceScore: parseAsInteger,
  website: parseAsStringLiteral(WEBSITE_FILTER_VALUES).withDefault("any"),
  instagram: parseAsStringLiteral(INSTAGRAM_FILTER_VALUES).withDefault("any"),
  gaps: parseAsArrayOf(parseAsStringLiteral(GAP_VALUES), ",").withDefault([]),
  pipeline: parseAsStringLiteral(PIPELINE_FILTER_VALUES).withDefault("any"),
  includeIgnored: parseAsBoolean.withDefault(false),
  sort: parseAsStringLiteral(SORT_VALUES).withDefault("score_desc"),
  limit: parseAsInteger.withDefault(25),
  offset: parseAsInteger.withDefault(0),
};

export type ListFilterState = {
  q: string;
  scanId: string;
  serviceId: string;
  categoryId: string;
  city: string;
  district: string;
  minScore: number | null;
  maxScore: number | null;
  minServiceScore: number | null;
  website: (typeof WEBSITE_FILTER_VALUES)[number];
  instagram: (typeof INSTAGRAM_FILTER_VALUES)[number];
  gaps: Array<(typeof GAP_VALUES)[number]>;
  pipeline: (typeof PIPELINE_FILTER_VALUES)[number];
  includeIgnored: boolean;
  sort: (typeof SORT_VALUES)[number];
  limit: number;
  offset: number;
};

export type ListFilterPatch = Partial<ListFilterState>;

export const EMPTY_FILTERS: ListFilterPatch = {
  q: "",
  scanId: "",
  serviceId: "",
  categoryId: "",
  city: "",
  district: "",
  minScore: null,
  maxScore: null,
  minServiceScore: null,
  website: "any",
  instagram: "any",
  gaps: [],
  pipeline: "any",
  includeIgnored: false,
  offset: 0,
};

export interface ListFilterController {
  filters: ListFilterState;
  /** Applies a patch and returns to the first page. */
  setFilter: (patch: ListFilterPatch) => void;
  /** Applies a patch without touching pagination (sorting, page size, paging). */
  setRaw: (patch: ListFilterPatch) => void;
  clear: () => void;
  pending: boolean;
}

/**
 * `shallow: false` makes each change re-run the Server Component that reads the
 * same query string, so the list is always rendered from the URL.
 */
export function useListFilters(): ListFilterController {
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(listFilterParsers, {
    shallow: false,
    clearOnDefault: true,
    history: "replace",
    scroll: false,
    startTransition,
  });

  const setRaw = useCallback(
    (patch: ListFilterPatch) => {
      void setFilters(patch);
    },
    [setFilters],
  );

  const setFilter = useCallback(
    (patch: ListFilterPatch) => {
      void setFilters({ ...patch, offset: 0 });
    },
    [setFilters],
  );

  const clear = useCallback(() => {
    void setFilters(EMPTY_FILTERS);
  }, [setFilters]);

  return { filters: filters as ListFilterState, setFilter, setRaw, clear, pending };
}
