"use client";

import { PaginationControls } from "@/components/shared";

import { PAGE_SIZE_OPTIONS, useListFilters } from "./filter-state";

/**
 * Pagination bound to the URL: the offset lives in the query string, so a
 * shared link opens on the same page of the same filtered list.
 */
export function ListPagination({ total }: { total: number }) {
  const { filters, setRaw } = useListFilters();
  const page = Math.floor(filters.offset / Math.max(1, filters.limit)) + 1;

  return (
    <PaginationControls
      page={page}
      pageSize={filters.limit}
      total={total}
      onChange={(next) => setRaw({ offset: Math.max(0, (next - 1) * filters.limit) })}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      onPageSizeChange={(size) => setRaw({ limit: size, offset: 0 })}
    />
  );
}
